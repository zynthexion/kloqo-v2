'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useUser } from '@/hooks/api/use-user';
import { useAppointments } from '@/hooks/api/use-appointments';
import { useDoctors } from '@/hooks/api/use-doctors';
import { apiRequest } from '@/lib/api-client';
import { getClinicNow, compareAppointments } from '@kloqo/shared-core';
import { parse, isSameDay, isPast, isToday } from 'date-fns';
import type { Appointment, Doctor, Clinic } from '@kloqo/shared';

/**
 * useAppointmentsState
 * Logic for fetching, caching, and filtering patient appointments.
 */
export function useAppointmentsState() {
    const { user, loading: userLoading } = useUser();
    const { appointments, loading: appointmentsLoading } = useAppointments((user as any)?.patientId);
    const { doctors, loading: doctorsLoading } = useDoctors();
    const [cachedAppointments, setCachedAppointments] = useState<Appointment[]>([]);
    const [clinics, setClinics] = useState<Record<string, Clinic>>({});

    const appointmentsCacheKey = (user as any)?.patientId ? `appointments-cache-${(user as any).patientId}` : null;

    // 1. Initial Cache Load
    useEffect(() => {
        if (!appointmentsCacheKey) return;
        const cached = localStorage.getItem(appointmentsCacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed.data)) setCachedAppointments(parsed.data);
            } catch (e) { localStorage.removeItem(appointmentsCacheKey); }
        }
    }, [appointmentsCacheKey]);

    // 2. Cache Persistence
    useEffect(() => {
        if (!appointmentsCacheKey || appointments.length === 0) return;
        localStorage.setItem(appointmentsCacheKey, JSON.stringify({ data: appointments, timestamp: new Date() }));
        setCachedAppointments(appointments);
    }, [appointmentsCacheKey, appointments]);

    // 3. Derived Helpers
    const doctorsByName = useMemo(() => {
        const map = new Map<string, Doctor>();
        doctors.forEach((d: Doctor) => map.set(d.name, d));
        return map;
    }, [doctors]);

    const handleAppointmentCancelled = useCallback((id: string) => {
        setCachedAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'Cancelled' as const } : a));
    }, []);

    const effectiveAppointments = useMemo(() => {
        const source = appointments.length > 0 ? appointments : cachedAppointments;
        return (source as any[]).filter(a => a.cancelledByBreak === undefined);
    }, [appointments, cachedAppointments]);

    // 4. Fetch Clinic Metadata via API
    useEffect(() => {
        const fetchClinics = async () => {
            const neededIds = Array.from(new Set(effectiveAppointments.map(a => a.clinicId).filter(id => id && !clinics[id])));
            if (neededIds.length === 0) return;
            
            const freshClinics = { ...clinics };
            await Promise.all(neededIds.map(async (id) => {
                try {
                    const res = await apiRequest(`/clinics/${id}`);
                    if (res?.clinic) freshClinics[id] = res.clinic;
                } catch {}
            }));
            setClinics(freshClinics);
        };
        fetchClinics();
    }, [effectiveAppointments, clinics]);

    const upcomingAppointments = useMemo(() => {
        return effectiveAppointments
            .filter(a => ['Pending', 'Confirmed', 'Skipped'].includes(a.status))
            .sort(compareAppointments as any);
    }, [effectiveAppointments]);

    const pastAppointments = useMemo(() => {
        return effectiveAppointments.filter(a => {
            if (['Completed', 'Cancelled', 'No-show'].includes(a.status)) return true;
            let date;
            try { date = parse(a.date, "d MMMM yyyy", new Date()); } catch { date = new Date(a.date); }
            const now = getClinicNow();
            return isPast(date) && !isSameDay(date, now);
        });
    }, [effectiveAppointments]);

    return {
        user,
        upcomingAppointments,
        pastAppointments,
        doctorsByName,
        clinics,
        appointmentsLoading: appointmentsLoading && effectiveAppointments.length === 0,
        userLoading,
        handleAppointmentCancelled
    };
}
