'use client';

/**
 * useLiveTokenListeners
 *
 * Migrated to V2 Backend API.
 * Uses polling to simulate live updates from the backend queue status.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getClinicNow, getClinicDateString } from '@kloqo/shared-core';
import type { Appointment, Doctor, Clinic } from '@kloqo/shared';
import { apiRequest } from '@/lib/api-client';
import { useSSE } from './use-sse';

interface UseLiveTokenListenersInput {
    clinicIds: string[];
    doctorId: string;
    clinicId: string;
    activeAppointment: Appointment | null;
}

interface UseLiveTokenListenersResult {
    allClinicAppointments: Appointment[];
    futureAppointments: Appointment[];
    allRelevantAppointments: Appointment[];
    liveDoctor: Doctor | null;
    clinics: Clinic[];
    loading: boolean;
}

export function useLiveTokenListeners({
    clinicIds,
    doctorId,
    clinicId,
    activeAppointment,
}: UseLiveTokenListenersInput): UseLiveTokenListenersResult {
    const [allClinicAppointments, setAllClinicAppointments] = useState<Appointment[]>([]);
    const [futureAppointments, setFutureAppointments] = useState<Appointment[]>([]);
    const [liveDoctor, setLiveDoctor] = useState<Doctor | null>(null);
    const [clinics, setClinics] = useState<Clinic[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. Fetch Clinics Metadata
    useEffect(() => {
        if (clinicIds.length === 0) return;
        let isMounted = true;

        const fetchClinics = async () => {
            try {
                // Backend discovery endpoint has been hardened. 
                // Context-specific clinic info should be fetched via /public-booking/clinics/:id
                /*
                const queryStr = clinicIds.map(id => `clinicIds[]=${id}`).join('&');
                const data = await apiRequest(`/discovery/public?${queryStr}`);
                if (isMounted && data.clinics) {
                    setClinics(data.clinics);
                }
                */
            } catch (err) {
                console.error('[useLiveTokenListeners] Fetch clinics error:', err);
            }
        };

        fetchClinics();
        return () => { isMounted = false; };
    }, [clinicIds]);

    // 2. Fetch Queue Status
    const fetchQueueStatus = useCallback(async () => {
        if (!doctorId || !clinicId) return;

        const now = getClinicNow();
        const todayStr = getClinicDateString(now);
        const appointmentDateStr = activeAppointment?.date || todayStr;

        try {
            // Get status for today or the appointment date through the hardened public booking API
            const data = await apiRequest(`/public-booking/clinics/${clinicId}/doctors/${doctorId}/queue?date=${appointmentDateStr}`);
            
            if (data) {
                // Map backend response to what frontend expects
                setLiveDoctor(data.doctor as Doctor);
                
                // If it's today's queue
                if (appointmentDateStr === todayStr) {
                    setAllClinicAppointments(data.masterQueue as Appointment[]);
                } else {
                    setFutureAppointments(data.masterQueue as Appointment[]);
                }
            }
        } catch (err) {
            console.error('[useLiveTokenListeners] Queue status fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [doctorId, clinicId, activeAppointment?.date]);

    useEffect(() => {
        fetchQueueStatus();
    }, [fetchQueueStatus]);

    // SSE: Listen for real-time updates from the backend
    useSSE({
        clinicId,
        onEvent: useCallback((event) => {
            if (['appointment_status_changed', 'walk_in_created', 'queue_updated', 'token_called'].includes(event.type)) {
                fetchQueueStatus();
            }
        }, [fetchQueueStatus])
    });

    // 3. Fallback/Special case for future appointments if not the current one
    // (Handled by the poll now since it uses activeAppointment?.date)

    // Merge today + future into a single de-duplicated list
    const allRelevantAppointments = useMemo<Appointment[]>(() => {
        const merged = [...allClinicAppointments, ...futureAppointments];
        const map = new Map<string, Appointment>();
        merged.forEach(apt => { if (!map.has(apt.id)) map.set(apt.id, apt); });
        return Array.from(map.values());
    }, [allClinicAppointments, futureAppointments]);

    return {
        allClinicAppointments,
        futureAppointments,
        allRelevantAppointments,
        liveDoctor,
        clinics,
        loading
    };
}
