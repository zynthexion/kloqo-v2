'use client';

/**
 * useLiveTokenListeners
 *
 * Migrated to V2 Backend API.
 * Uses SSE for real-time updates with a resilience layer:
 *   1. appointment_reslotted → instant EWT recalculation (Phase 4)
 *   2. Foreground Sync → re-fetches queue when tab regains visibility (Phase 4)
 *   3. 60s Polling Fallback → activates when SSE drops, stops when it reconnects (Phase 4)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 1. Fetch Clinics Metadata
    useEffect(() => {
        if (clinicIds.length === 0) return;
        // Clinic metadata loaded from clinicData in parent context via /clinics/:id
    }, [clinicIds]);

    // 2. Core Queue Fetch
    const fetchQueueStatus = useCallback(async () => {
        if (!doctorId || !clinicId) return;

        const now = getClinicNow();
        const todayStr = getClinicDateString(now);
        const appointmentDateStr = activeAppointment?.date || todayStr;

        try {
            const data = await apiRequest(`/public-booking/clinics/${clinicId}/doctors/${doctorId}/queue?date=${appointmentDateStr}`);
            
            if (data) {
                setLiveDoctor(data.doctor as Doctor);
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

    // 3. Initial fetch
    useEffect(() => {
        fetchQueueStatus();
    }, [fetchQueueStatus]);

    // 4. Foreground Sync: Re-fetch when the patient brings the app back into view.
    //    Handles the case where SSE missed events while the app was minimized.
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[useLiveTokenListeners] App foregrounded — re-syncing queue...');
                fetchQueueStatus();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [fetchQueueStatus]);

    // 5. SSE: Primary real-time channel.
    //    appointment_reslotted → triggers EWT recalculation by refreshing queue state.
    const { readyState } = useSSE({
        clinicId,
        onEvent: useCallback((event) => {
            // All queue-mutating events trigger a re-fetch.
            // appointment_reslotted specifically ensures EWT instantly reflects the new slot order.
            const queueEvents = [
                'appointment_status_changed',
                'walk_in_created',
                'queue_updated',
                'token_called',
                'appointment_reslotted', // EWT instant bind: slot moved → refresh queue → UI recalculates EWT
            ];
            if (queueEvents.includes(event.type)) {
                fetchQueueStatus();
            }
        }, [fetchQueueStatus])
    });

    // 6. 60s Polling Fallback: Activates when SSE is CONNECTING or CLOSED.
    //    Stops automatically once the SSE connection is re-established (OPEN).
    useEffect(() => {
        const SSE_OPEN = 1; // EventSource.OPEN

        if (readyState !== SSE_OPEN) {
            // SSE is down — start polling every 60 seconds
            if (!pollingIntervalRef.current) {
                console.warn('[useLiveTokenListeners] SSE unavailable — starting 60s polling fallback.');
                pollingIntervalRef.current = setInterval(() => {
                    fetchQueueStatus();
                }, 60_000);
            }
        } else {
            // SSE is up — clear polling fallback
            if (pollingIntervalRef.current) {
                console.log('[useLiveTokenListeners] SSE restored — stopping polling fallback.');
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        }

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [readyState, fetchQueueStatus]);

    // 7. Merge today + future into a de-duplicated list
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

