'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useDoctors } from '@/hooks/api/use-doctors';
import { useAppointments } from '@/hooks/api/use-appointments';
import { useLocation } from '@/hooks/use-location';
import { useLanguage } from '@/contexts/language-context';
import { useMasterDepartments } from '@/hooks/use-master-departments';
import { useToast } from '@/hooks/use-toast';
import { useCachedData } from '@/hooks/use-cached-data';
import { apiRequest } from '@/lib/api-client';
import { getLocalizedDepartmentName } from '@/lib/department-utils';
import { compareAppointments } from '@kloqo/shared-core';
import { isToday } from 'date-fns/isToday';
import { isPast } from 'date-fns/isPast';
import { parseClinicDate } from '@/lib/utils';
import useSWR from 'swr';
import type { Doctor, Appointment, Clinic } from '@kloqo/shared';

const fetchJson = (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json());

export type SearchResult =
    | ({ type: 'doctor' } & Doctor)
    | ({ type: 'clinic'; id: string; name: string; location?: string; avatar?: string });

const EMPTY_ARRAY: any[] = [];

/**
 * useHomeState

 * Centralized business logic for the Home Page.
 * Handles: Data Fetching, Search, Location, QR Scanning, Splash Control.
 */
export function useHomeState() {
    const router = useRouter();
    const { t, language } = useLanguage();
    const { departments } = useMasterDepartments();
    const { toast } = useToast();
    const { user } = useAuth();

    // 1. Splash & Load State
    const [splashAnimationDone, setSplashAnimationDone] = useState(false);
    const [hasShownSplashInSession, setHasShownSplashInSession] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // 2. Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>(EMPTY_ARRAY);

    const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // 3. QR Scanner State
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [scanMode, setScanMode] = useState<'consult' | 'confirm' | null>(null);
    const isProcessingScanRef = useRef(false);

    // 4. Location & Tabs
    const [activeTab, setActiveTab] = useState<'myDoctors' | 'nearbyDoctors'>('myDoctors');
    const { location, userLocation, isLocationLoading, isRefreshingLocation, refreshLocation } = useLocation({
        activeTab: activeTab === 'nearbyDoctors' ? 'all' : 'history',
        detectingLabel: t.common?.home || 'Detecting...',
        notSupportedLabel: t.common?.home || 'Not Supported',
        notAvailableLabel: t.common?.home || 'Not Available',
        currentLocationLabel: t.common?.home || 'Current Location',
    });

    // Smart Permission Guard: Default to "My Doctors" if location denied
    useEffect(() => {
        if (activeTab === 'nearbyDoctors' && !userLocation && !isLocationLoading) {
             // We don't force a switch, but we'll show the fallback message in UI
        }
    }, [activeTab, userLocation, isLocationLoading]);

    // 5. Data Fetching
    const clinicIdFromUser = (user as any)?.clinicId;
    const clinicIds = useMemo(() => {
        if ((user as any)?.clinicIds) return (user as any).clinicIds;
        if (clinicIdFromUser) return [clinicIdFromUser];
        return [];
    }, [user, clinicIdFromUser]);

    const { doctors: userDoctors, loading: doctorsLoading } = useDoctors(clinicIds);
    const { appointments: familyAppointments, loading: appointmentsLoading } = useAppointments((user as any)?.patientId);
    
    // Fetch Clinic Metadata for the patient's linked clinics
    const clinicsUrl = clinicIds.length > 0 ? `/public-booking/clinics?ids=${clinicIds.join(',')}` : null;
    const { data: clinicsResponse } = useSWR<any>(clinicsUrl, apiRequest, { revalidateOnFocus: false, dedupingInterval: 300000 });
    const allClinicsData: Clinic[] = useMemo(() => clinicsResponse?.clinics ?? [], [clinicsResponse]);

    // ⚡ HISTORY DEDUPLICATION: Extracts unique IDs from patient history to ensure visibility
    const historyDoctorIds = useMemo(() => {
        const ids = new Set<string>();
        familyAppointments.forEach((a: any) => {
            if (a.doctorId) ids.add(a.doctorId);
        });
        return Array.from(ids);
    }, [familyAppointments]);

    // 6. Discovery Hydration (History Metadata)
    // We only fetch metadata for doctors in history that AREN'T in the current userDoctors list
    const missingDoctorIds = useMemo(() => {
        const currentIds = new Set(userDoctors.map(d => d.id));
        return historyDoctorIds.filter(id => !currentIds.has(id));
    }, [userDoctors, historyDoctorIds]);

    const discoveryUrl = missingDoctorIds.length > 0 
        ? `/doctors?doctorIds=${missingDoctorIds.join(',')}` 
        : null;

    const { data: discoveryResponse, isLoading: discoveryLoading } = useSWR<any>(
        discoveryUrl,
        apiRequest,
        { revalidateOnFocus: false, dedupingInterval: 60000 }
    );
    
    const historyDoctors: Doctor[] = useMemo(() => {
        const data = Array.isArray(discoveryResponse) ? discoveryResponse : (discoveryResponse?.data ?? []);
        return data;
    }, [discoveryResponse]);

    // Combined pool for My Doctors
    const myDoctors = useMemo(() => {
        const merged = [...userDoctors, ...historyDoctors];
        const unique = new Map<string, Doctor>();
        merged.forEach(d => unique.set(d.id, d));
        return Array.from(unique.values());
    }, [userDoctors, historyDoctors]);

    // 7. Caching & Derived Data
    const cachedAppointments = useCachedData<Appointment[]>((user as any)?.id ? `appointments:${(user as any).id}` : null, familyAppointments, !appointmentsLoading);
    
    const effectiveAppointments = useMemo(() => familyAppointments.length > 0 ? familyAppointments : (cachedAppointments ?? []), [familyAppointments, cachedAppointments]);
    
    const nearbyDoctors = useMemo(() => {
        if (!userLocation) return EMPTY_ARRAY;
        // Search in the pool of doctors the patient has access to/history with
        return myDoctors.filter((d: any) => {
            if (!d.latitude || !d.longitude) return false;
            // Radius check (50km)
            const R = 6371;
            const dLat = (d.latitude - userLocation.lat) * Math.PI / 180;
            const dLon = (d.longitude - userLocation.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(userLocation.lat * Math.PI/180) * Math.cos(d.latitude * Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return dist <= 50;
        });
    }, [myDoctors, userLocation]);

    const walkInAppointment = useMemo(() => {
        const active = effectiveAppointments.filter((a: Appointment) => 
            a.tokenNumber?.startsWith('W') && 
            isToday(parseClinicDate(a.date)) &&
            a.status !== 'Cancelled' && a.status !== 'Completed' && (a as any).cancelledByBreak === undefined
        );
        return active.sort(compareAppointments as any)[0] || null;
    }, [effectiveAppointments]);

    const upcomingAppointments = useMemo(() => {
        return effectiveAppointments.filter((a: Appointment) => {
            if ((a as any).cancelledByBreak !== undefined || a.status === 'Cancelled' || a.status === 'Completed') return false;
            
            const date = parseClinicDate(a.date);
            if (a.tokenNumber?.startsWith('W')) {
                if (isToday(date)) return false;
            }
            return !isPast(date) || isToday(date);
        }).sort(compareAppointments as any);
    }, [effectiveAppointments]);

    // 8. Handlers
    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => setDebouncedSearchQuery(value), 300);
    }, []);

    const handleSearchClear = useCallback(() => {
        setSearchQuery('');
        setDebouncedSearchQuery('');
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    }, []);

    const handleScanQR = (mode: 'consult' | 'confirm') => {
        setScanMode(mode);
        setShowQRScanner(true);
    };

    const handleScanResult = useCallback(async (decodedText: string) => {
        if (isProcessingScanRef.current) return;
        isProcessingScanRef.current = true;
        setShowQRScanner(false);

        try {
            const url = new URL(decodedText, window.location.origin);
            const clinicId = url.searchParams.get('clinic') || url.searchParams.get('clinicId') || decodedText;
            
            if (!clinicId) throw new Error('No clinic ID');

            if (scanMode === 'consult') router.push(`/consult-today?clinicId=${clinicId}`);
            else router.push(`/confirm-arrival?clinic=${clinicId}`);
            
        } catch (error) {
            toast({ variant: 'destructive', title: 'Invalid QR Code' });
        } finally {
            setTimeout(() => { isProcessingScanRef.current = false; }, 1000);
        }
    }, [router, scanMode, toast]);

    // 8. Booking Selection Flow
    const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState<Doctor | null>(null);
    const [isBookingChoiceOpen, setIsBookingChoiceOpen] = useState(false);
    const [selectedDoctorDistance, setSelectedDoctorDistance] = useState<number | null>(null);

    /**
     * Context-Aware Booking Choice
     * Instead of auto-routing, we open a choice modal that highlights the best option based on distance.
     */
    const handleDoctorClick = useCallback((doctor: Doctor) => {
        let currentDist: number | null = null;
        const dLat = (doctor as any).latitude;
        const dLng = (doctor as any).longitude;

        if (userLocation && dLat && dLng) {
            const R = 6371e3;
            const φ1 = userLocation.lat * Math.PI / 180;
            const φ2 = dLat * Math.PI / 180;
            const Δφ = (dLat - userLocation.lat) * Math.PI / 180;
            const Δλ = (dLng - userLocation.lng) * Math.PI / 180;
            const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            currentDist = R * c;
        }

        setSelectedDoctorForBooking(doctor);
        setSelectedDoctorDistance(currentDist);
        setIsBookingChoiceOpen(true);
    }, [userLocation]);

    const confirmWalkIn = useCallback((doctor: Doctor) => {
        setIsBookingChoiceOpen(false);
        router.push(`/consult-today?doctorId=${doctor.id}&clinicId=${doctor.clinicId}`);
    }, [router]);

    const confirmAdvanced = useCallback((doctor: Doctor) => {
        setIsBookingChoiceOpen(false);
        router.push(`/book-appointment?doctorId=${doctor.id}`);
    }, [router]);

    // 9. Sync & Lifecycle
    useEffect(() => {
        if (debouncedSearchQuery) {
            const queryLower = debouncedSearchQuery.toLowerCase();
            const filteredDoctors = myDoctors.filter((d: Doctor) => 
                d.name.toLowerCase().includes(queryLower) || 
                d.specialty?.toLowerCase().includes(queryLower) ||
                getLocalizedDepartmentName(d.department, language, departments).toLowerCase().includes(queryLower)
            ).map((d: Doctor) => ({ type: 'doctor' as const, ...d }));

            const filteredClinics = allClinicsData.filter(c => 
                c.name?.toLowerCase().includes(queryLower) ||
                c.address?.toLowerCase().includes(queryLower)
            ).map(c => ({ 
                type: 'clinic' as const, id: c.id, name: c.name, location: c.address, avatar: c.logoUrl 
            }));

            setSearchResults([...filteredClinics, ...filteredDoctors]);
        } else {
            setSearchResults(EMPTY_ARRAY);
        }

    }, [debouncedSearchQuery, myDoctors, allClinicsData, language, departments]);

    useEffect(() => {
        if (user && !appointmentsLoading && (!doctorsLoading || myDoctors.length > 0)) {
            setIsInitialLoad(false);
        }
    }, [user, appointmentsLoading, doctorsLoading, myDoctors]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const flag = window.sessionStorage.getItem('homeSplashShown');
            if (flag === '1') setHasShownSplashInSession(true);
        }
    }, []);

    const handleSplashComplete = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('homeSplashShown', '1');
            setSplashAnimationDone(true);
            setHasShownSplashInSession(true);
        }
    }, []);

    return {
        user, t, language, departments,
        location, isRefreshingLocation, isLocationLoading, refreshLocation, userLocation,
        searchQuery, searchResults, handleSearchChange, handleSearchClear, setSearchQuery,
        showQRScanner, setShowQRScanner, scanMode, handleScanQR, handleScanResult,
        walkInAppointment, upcomingAppointments, appointmentsLoading,
        effectiveUserDoctors: myDoctors, 
        displayDoctors: activeTab === 'nearbyDoctors' ? nearbyDoctors : myDoctors,
        isLoadingDoctors: discoveryLoading || (doctorsLoading && myDoctors.length === 0),
        activeTab, setActiveTab, allClinicsData,
        splashAnimationDone, hasShownSplashInSession, handleSplashComplete, dataReady: !appointmentsLoading && !discoveryLoading,
        router,
        handleDoctorClick,
        isBookingChoiceOpen, setIsBookingChoiceOpen, selectedDoctorForBooking, selectedDoctorDistance,
        confirmWalkIn, confirmAdvanced
    };
}
