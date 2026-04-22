'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addDays, format } from 'date-fns';
import { apiRequest } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import { useToast } from '@/hooks/use-toast';
import { getDoctorFromCache, saveDoctorToCache } from '@/lib/doctor-cache';
import { useDebouncedTime } from '@/hooks/use-debounced-time';
import { formatMonthYear } from '@/lib/date-utils';
import { useAuth } from '@/contexts/AuthContext';
import type { Doctor } from '@kloqo/shared';
import type { CarouselApi } from "@/components/ui/carousel";
import { useSSE } from '@/hooks/use-sse';
import { getClinicNow, parseClinicDate, getClinicISOString } from '@kloqo/shared-core';


/**
 * useBookingState
 * Encapsulates all scheduling, date selection, and slot availability logic for the Book Appointment page.
 */
export function useBookingState() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { t, language } = useLanguage();
    const { user, loading: userLoading } = useAuth();

    // 1. Query Params
    const doctorId = searchParams.get('doctorId');
    const patientIdFromParams = searchParams.get('patientId');
    const clinicIdFromParams = searchParams.get('clinicId');
    const isEditMode = searchParams.get('edit') === 'true';
    const appointmentId = searchParams.get('appointmentId');
    const source = searchParams.get('source');
    const isPhoneBooking = source === 'phone';
    const preselectedDate = searchParams.get('date');
    const preselectedSlot = searchParams.get('slot');


    // 2. Doctor Data
    const cachedDoctor = doctorId ? getDoctorFromCache(doctorId) : null;
    const [doctor, setDoctor] = useState<Doctor | null>(cachedDoctor);
    const [loading, setLoading] = useState(!cachedDoctor);
    const [clinicId, setClinicId] = useState<string | null>(cachedDoctor?.clinicId || null);

    // 3. Date Selection
    // Dubai Patient Trap: Initialize with IST time
    const [selectedDate, setSelectedDate] = useState<Date>(getClinicNow());
    const [dates, setDates] = useState<Date[]>([]);
    const [currentMonth, setCurrentMonth] = useState(formatMonthYear(getClinicNow(), language));
    const [dateCarouselApi, setDateCarouselApi] = useState<CarouselApi>();
    const datesInitializedRef = useRef(false);
    const userSelectedDateRef = useRef(false);
    const isInitialFetch = useRef(true);

    // 4. Slots & Availability
    // selectedSlot stores the full backend DecoratedSlot object so slotIndex
    // and sessionIndex are available for the booking POST without extra lookups.
    const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
    const [backendSlots, setBackendSlots] = useState<any[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(true);
    const currentTime = useDebouncedTime(120000);

    // Initial state from URL
    useEffect(() => {
        if (preselectedDate && !userSelectedDateRef.current) {
            const date = parseClinicDate(preselectedDate);
            if (!isNaN(date.getTime())) {
                setSelectedDate(date);
                setCurrentMonth(formatMonthYear(date, language));
            }
        }
        if (preselectedSlot) {
            const slot = new Date(preselectedSlot);
            if (!isNaN(slot.getTime())) {
                setSelectedSlot(slot);
            }
        }
    }, [preselectedDate, preselectedSlot, language]);


    // 5. Fetch Doctor Details
    useEffect(() => {
        if (!doctorId) return;
        
        // Circuit Breaker: Only fetch if initial or doctorId changed
        if (!isInitialFetch.current && doctor?.id === doctorId) return;

        const controller = new AbortController();

        const fetchDoctor = async () => {
            if (!cachedDoctor) setLoading(true);
            try {
                const res = await apiRequest(`/public-booking/doctors/${doctorId}`, { signal: controller.signal });
                console.log('[DEBUG] useBookingState - Raw API Response:', res);
                const currentDoctor: Doctor = res?.doctor || res;
                
                setDoctor(currentDoctor);
                setClinicId(currentDoctor.clinicId || null);
                saveDoctorToCache(doctorId, currentDoctor);
                isInitialFetch.current = false;

                const nowIst = getClinicNow();
                const todayBaselineIst = parseClinicDate(getClinicISOString(nowIst));

                const availableDays = (currentDoctor.availabilitySlots || []).map((s: any) => {
                    if (typeof s.day === 'number') return s.day;
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    return dayNames.indexOf(s.day);
                });

                console.log('[DEBUG] useBookingState - Doctor:', currentDoctor.name, 'Available Days (Indices):', availableDays);

                // Future Window Guard
                const advanceBookingDays = (currentDoctor as any).advanceBookingDays ?? 7;
                
                const futureDates = Array.from(
                    { length: advanceBookingDays + 1 }, 
                    (_, i) => addDays(todayBaselineIst, i)
                );
                
                const availableDates = futureDates.filter(d => availableDays.includes(d.getDay()));
                
                console.log('[DEBUG] useBookingState - Advance Window:', advanceBookingDays);
                console.log('[DEBUG] useBookingState - Filtered (Available) Dates:', availableDates.map(d => format(d, 'yyyy-MM-dd')));

                setDates(availableDates);
                if (!userSelectedDateRef.current) {
                    const first = availableDates[0];
                    if (first) {
                        setSelectedDate(first);
                        setCurrentMonth(formatMonthYear(first, language));
                    }
                }
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                toast({ variant: 'destructive', title: t.bookAppointment.error });
            } finally {
                setLoading(false);
            }
        };

        fetchDoctor();
        return () => controller.abort();
    }, [doctorId, language]); // Only depends on primitives that trigger meaningful state changes

    // 6. Fetch Slot Availability from Backend (canonical source of truth)
    // The backend applies a 30-minute buffer and decorates slots for patient consumption.
    // Breaks are hidden (shown as 'booked') and the 85/15 walk-in reserve is enforced.
    // State is declared in section 4 above.
    const fetchSlots = useCallback(async () => {
        const effectiveClinicId = clinicId || clinicIdFromParams;
        const effectiveDoctorId = doctor?.id || doctorId;
        if (!selectedDate || !effectiveClinicId || !effectiveDoctorId) return;

        setSlotsLoading(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const data = await apiRequest<any>(
              `/public-booking/doctors/${effectiveDoctorId}/slots?clinicId=${effectiveClinicId}&date=${encodeURIComponent(dateStr)}`
            );
            setBackendSlots(data?.slots || []);
        } catch (err) {
            console.error('Slot fetch error:', err);
            setBackendSlots([]);
        } finally {
            setSlotsLoading(false);
        }
    }, [clinicId, clinicIdFromParams, doctor?.id, doctorId, selectedDate]);

    useEffect(() => {
        fetchSlots();
    }, [fetchSlots]);

    // Derived from backend slots — no client-side capacity math needed
    const isAdvanceCapacityReached = backendSlots.length > 0 && !backendSlots.some((s: any) => s.status === 'available');


    // SSE: Real-time updates instead of 30s polling
    useSSE({
        clinicId: clinicId || clinicIdFromParams || doctor?.clinicId,
        onEvent: useCallback((event) => {
            // If any appointment activity happens, slots might have changed
            if (['appointment_status_changed', 'walk_in_created', 'queue_updated', 'token_called'].includes(event.type)) {
                fetchSlots();
            }
        }, [fetchSlots])
    });

    // 7. Handlers
    const handleDateSelect = (date: Date) => {
        userSelectedDateRef.current = true;
        setSelectedDate(date);
        setSelectedSlot(null);
        setCurrentMonth(formatMonthYear(date, language));
    };

    const handleSlotSelect = (slot: any) => {
        // Buffer enforcement is already done by the backend (30-min patient buffer).
        // Toggle by slotIndex so the full slot object (with slotIndex/sessionIndex) is persisted.
        setSelectedSlot((prev: any) =>
            prev?.slotIndex === slot.slotIndex ? null : slot
        );
    };

    const handleProceed = () => {
        if (isAdvanceCapacityReached) return;
        if (!selectedSlot || !doctor) return;

        const params = new URLSearchParams();
        params.set('doctorId', doctor.id);
        // Pass the ISO time for display on the details page
        params.set('slot', new Date(selectedSlot.time).toISOString());
        // Pass slot metadata so the booking POST has exact indices without a re-lookup
        params.set('slotIndex', String(selectedSlot.slotIndex));
        params.set('sessionIndex', String(selectedSlot.sessionIndex));

        if (isEditMode && appointmentId && patientIdFromParams && clinicIdFromParams) {
            params.set('edit', 'true');
            params.set('appointmentId', appointmentId);
            params.set('patientId', patientIdFromParams);
            router.push(`/book-appointment/summary?${params.toString()}`);
            return;
        }

        if (isPhoneBooking && patientIdFromParams) {
            params.set('patientId', patientIdFromParams);
            params.set('source', 'phone');
        } else {
            params.set('source', 'online');
        }

        const nextPath = `/book-appointment/details?${params.toString()}`;
        
        // Ensure user is logged in before proceeding to details
        if (!user && !userLoading) {
            toast({ title: "Login Required", description: "Please login to confirm your booking details." });
            router.push(`/login?redirect=${encodeURIComponent(nextPath)}`);
            return;
        }

        router.push(nextPath);
    };

    return {
        doctor, loading,
        selectedDate, dates, currentMonth, handleDateSelect,
        selectedSlot, handleSlotSelect, slotsLoading,
        backendSlots, isAdvanceCapacityReached,
        handleProceed,
        doctorId, isPhoneBooking, patientIdFromParams, clinicIdFromParams,
        dateCarouselApi, setDateCarouselApi,
        language, t, router
    };
}
