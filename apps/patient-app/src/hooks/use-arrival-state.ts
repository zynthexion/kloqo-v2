'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getClinicNow, getClinicDateString, compareAppointments } from '@kloqo/shared-core';
import { apiRequest } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/language-context';
import { differenceInMinutes } from 'date-fns';
import { parseTime } from '@kloqo/shared-core';
import { useSSE } from './use-sse';

import type { Appointment, Clinic, Doctor } from '@kloqo/shared';

/**
 * calculateDistance
 * Calculates meters between two coordinates.
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * useArrivalState
 * Logic for GPS distance check, appointment status transitions, and arrival confirmation.
 */
export function useArrivalState() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user, loading: userLoading } = useAuth();
    const { toast } = useToast();
    const { t, language } = useLanguage();

    const clinicId = searchParams.get('clinic') || searchParams.get('clinicId');

    // State
    const [clinic, setClinic] = useState<Clinic | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isCheckingLocation, setIsCheckingLocation] = useState(false);
    const [isConfirming, setIsConfirming] = useState<string | null>(null);
    const [lateMinutes, setLateMinutes] = useState<{ [appointmentId: string]: number }>({});
    const [isUpdatingLate, setIsUpdatingLate] = useState<string | null>(null);
    const [expandedAppointments, setExpandedAppointments] = useState<Set<string>>(new Set());

    // 1. Fetch Clinic & Doctors
    useEffect(() => {
        if (!clinicId) return;
        apiRequest(`/clinics/${clinicId}`).then(res => res?.clinic && setClinic(res.clinic));
        apiRequest(`/doctors?clinicId=${clinicId}`).then(res => res?.doctors && setDoctors(res.doctors));
    }, [clinicId]);

    // 2. Poll Appointments
    const fetchAppointments = useCallback(async () => {
        if (!user?.id || !clinicId) return;
        const today = getClinicDateString(getClinicNow());
        try {
            const res = await apiRequest(`/patients/${user.id}/appointments?clinicId=${clinicId}&date=${encodeURIComponent(today)}`);
            setAppointments(res?.appointments || []);
            setAppointmentsLoaded(true);
        } catch (err) { console.error('Fetch apps error:', err); }
    }, [user?.id, clinicId]);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    // SSE: Listen for real-time updates from the backend
    useSSE({
        clinicId,
        onEvent: useCallback((event) => {
            if (['appointment_status_changed', 'walk_in_created', 'queue_updated'].includes(event.type)) {
                fetchAppointments();
            }
        }, [fetchAppointments])
    });

    // 3. Location Checking
    const checkLocation = useCallback(() => {
        if (!clinic?.latitude || !clinic?.longitude) {
            setLocationError('Clinic location not available');
            return;
        }

        setIsCheckingLocation(true);
        setLocationError(null);

        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported');
            setIsCheckingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLocation({ lat: latitude, lng: longitude });
                const distance = calculateDistance(latitude, longitude, clinic.latitude!, clinic.longitude!);
                if (distance > 200) {
                    setLocationError(`You are ${Math.round(distance)}m away. Must be within 200m.`);
                } else {
                    setLocationError(null);
                }
                setIsCheckingLocation(false);
            },
            (error) => {
                setLocationError('Location access denied or unavailable');
                setIsCheckingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, [clinic]);

    useEffect(() => {
        if (clinic?.latitude && !location && !locationError) checkLocation();
    }, [clinic, checkLocation, location, locationError]);

    // 4. Derived Collections
    const pendingAppointments = useMemo(() => {
        const now = getClinicNow();
        return appointments.filter(apt => {
            if (apt.status !== 'Pending' || !(apt as any).cutOffTime) return false;
            const cot = (apt as any).cutOffTime;
            let cutOffDate: Date;
            if (typeof cot?.toDate === 'function') {
                cutOffDate = cot.toDate();
            } else if (cot instanceof Date) {
                cutOffDate = cot;
            } else {
                cutOffDate = new Date(cot);
            }
            if (isNaN(cutOffDate.getTime())) return false;
            const diff = differenceInMinutes(cutOffDate, now);
            return diff >= -5 && diff <= 120;
        }).sort((a,b) => parseTime(a.time, new Date()).getTime() - parseTime(b.time, new Date()).getTime());
    }, [appointments]);

    const skippedAppointments = useMemo(() => {
        return appointments.filter(apt => apt.status === 'Skipped' || apt.status === 'No-show').sort(compareAppointments as any);
    }, [appointments]);

    const confirmedAppointments = useMemo(() => {
        return appointments.filter(apt => apt.status === 'Confirmed');
    }, [appointments]);

    const isLocationValid = useMemo(() => {
        if (!location || !clinic?.latitude || !clinic?.longitude) return false;
        return calculateDistance(location.lat, location.lng, clinic.latitude, clinic.longitude) <= 200;
    }, [location, clinic]);

    // 5. Interaction Handlers
    const handleConfirmArrival = async (appointment: Appointment) => {
        if (!isLocationValid) {
            toast({ variant: 'destructive', title: 'Location Error', description: 'Ensure you are within 200m of the clinic.' });
            return;
        }
        setIsConfirming(appointment.id);
        try {
            await apiRequest(`/appointments/${appointment.id}/confirm`, { method: 'POST' });
            toast({ title: 'Arrival Confirmed' });
            fetchAppointments();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Retry confirming arrival.' });
        } finally { setIsConfirming(null); }
    };

    const handleUpdateLateMinutes = async (appointment: Appointment, minutes: number) => {
        setIsUpdatingLate(appointment.id);
        try {
            await apiRequest(`/appointments/${appointment.id}`, { method: 'PATCH', body: JSON.stringify({ lateMinutes: minutes }) });
            setLateMinutes(prev => ({ ...prev, [appointment.id]: minutes }));
            toast({ title: 'Late Minutes Updated' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error' });
        } finally { setIsUpdatingLate(null); }
    };

    const toggleExpand = (id: string) => {
        setExpandedAppointments(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // 6. Navigation Side-effects
    useEffect(() => {
        if (!appointmentsLoaded || !clinicId) return;
        if (confirmedAppointments.length > 0) {
            router.push(`/live-token/${confirmedAppointments[0].id}`);
        } else if (pendingAppointments.length === 0 && skippedAppointments.length === 0) {
            router.push(`/consult-today?clinicId=${clinicId}`);
        }
    }, [appointmentsLoaded, pendingAppointments.length, skippedAppointments.length, confirmedAppointments, clinicId, router]);

    return {
        clinic, doctors,
        location, locationError, isCheckingLocation, checkLocation, isLocationValid,
        pendingAppointments, skippedAppointments, confirmedAppointments,
        handleConfirmArrival, handleUpdateLateMinutes, isConfirming, isUpdatingLate,
        expandedAppointments, toggleExpand, lateMinutes,
        userLoading, user, clinicId, t, router
    };
}
