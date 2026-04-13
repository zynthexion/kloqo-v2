'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addDays, format, isSameDay, startOfDay, addMinutes, isBefore } from 'date-fns';
import { apiRequest } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import { useToast } from '@/hooks/use-toast';
import { getDoctorFromCache, saveDoctorToCache } from '@/lib/doctor-cache';
import { useDebouncedTime } from '@/hooks/use-debounced-time';
import { useBookingCapacity } from '@/hooks/use-booking-capacity';
import { formatMonthYear } from '@/lib/date-utils';
import { parseAppointmentDateTime } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { Doctor, Appointment } from '@kloqo/shared';
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
    const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
    const [allBookedSlots, setAllBookedSlots] = useState<number[]>([]);
    const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
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

    const {
        isAdvanceCapacityReached,

        sessionSlots,
        remainingCapacity
    } = useBookingCapacity({
        doctor,
        selectedDate,
        allAppointments,
        allBookedSlots,
        currentTime,
        t,
        language
    });

    // 5. Fetch Doctor Details
    useEffect(() => {
        if (!doctorId) return;
        
        // Circuit Breaker: Only fetch if initial or doctorId changed
        if (!isInitialFetch.current && doctor?.id === doctorId) return;

        const controller = new AbortController();

        const fetchDoctor = async () => {
            if (!cachedDoctor) setLoading(true);
            try {
                const res = await apiRequest(`/doctors/${doctorId}`, { signal: controller.signal });
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

    // 6. Fetch Slot Availability
    const fetchSlots = useCallback(async () => {
        const effectiveClinicId = clinicId || clinicIdFromParams;
        const effectiveDoctorId = doctor?.id || doctorId;
        if (!selectedDate || !effectiveClinicId || !effectiveDoctorId) return;

        setSlotsLoading(true);
        try {
            const dateStr = format(selectedDate, 'd MMMM yyyy');
            const res = await apiRequest(`/appointments/public?clinicId=${effectiveClinicId}&doctorId=${effectiveDoctorId}&date=${encodeURIComponent(dateStr)}`);
            const apps: Appointment[] = res?.appointments || [];
            setAllAppointments(apps);
            setAllBookedSlots(apps.filter(a => !a.tokenNumber?.startsWith('W') && ['Pending', 'Confirmed', 'Completed'].includes(a.status)).map(a => parseAppointmentDateTime(a.date, a.time).getTime()));
        } catch (err) {
            console.error('Slot fetch error:', err);
        } finally {
            setSlotsLoading(false);
        }
    }, [clinicId, clinicIdFromParams, doctor?.id, doctorId, selectedDate]);

    useEffect(() => {
        fetchSlots();
    }, [fetchSlots]);

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

    const handleSlotSelect = (slot: Date) => {
        const now = currentTime;
        if (isSameDay(selectedDate, now)) {
            if (isBefore(slot, addMinutes(now, 30))) {
                toast({ variant: "destructive", title: "Invalid Slot", description: "Slots must be at least 30 mins from now." });
                return;
            }
        }
        setSelectedSlot(prev => prev?.getTime() === slot.getTime() ? null : slot);
    };

    const handleProceed = () => {
        if (isAdvanceCapacityReached) return;
        if (!selectedSlot || !doctor) return;

        const params = new URLSearchParams();
        params.set('doctorId', doctor.id);
        params.set('slot', selectedSlot.toISOString());

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
        sessionSlots, isAdvanceCapacityReached,
        handleProceed,
        doctorId, isPhoneBooking, patientIdFromParams, clinicIdFromParams,
        dateCarouselApi, setDateCarouselApi,
        language, t, router
    };
}
