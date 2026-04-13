'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { apiRequest } from '@/lib/api-client';
import { getClinicNow, getClinicDateString } from '@kloqo/shared-core';
import type { Appointment } from '@kloqo/shared';

interface UseLiveQueueParams {
    clinicIds: string[];
    activeAppointmentDate?: string;
    activeAppointmentClinicId?: string;
}

interface UseLiveQueueResult {
    allClinicAppointments: Appointment[];
    allRelevantAppointments: Appointment[];
    isLoadingAppointments: boolean;
}

export function useLiveQueue({
    clinicIds,
    activeAppointmentDate,
    activeAppointmentClinicId,
}: UseLiveQueueParams): UseLiveQueueResult {
    const now = getClinicNow();
    const todayStr = getClinicDateString(now);

    const targetClinicIds = activeAppointmentClinicId
        ? [activeAppointmentClinicId]
        : clinicIds;

    // Fetch today's appointments
    const { data: todayData, isLoading: todayLoading } = useSWR<any>(
        targetClinicIds.length > 0 ? `/discovery/public?clinicIds=${targetClinicIds.join(',')}&date=${todayStr}` : null,
        apiRequest,
        { refreshInterval: 15000 }
    );
    const allClinicAppointments = useMemo(() => todayData?.appointments || [], [todayData]);

    // Fetch future/specific date appointments if needed
    const shouldFetchFuture = activeAppointmentDate && activeAppointmentDate !== todayStr;
    const { data: futureData } = useSWR<any>(
        shouldFetchFuture && targetClinicIds.length > 0 
            ? `/discovery/public?clinicIds=${targetClinicIds.join(',')}&date=${activeAppointmentDate}` 
            : null,
        apiRequest,
        { refreshInterval: 15000 }
    );
    const appointmentDateAppointments = useMemo(() => futureData?.appointments || [], [futureData]);

    const isLoadingAppointments = todayLoading;

    // Merge & Deduplicate
    const allRelevantAppointments = useMemo(() => {
        if (!activeAppointmentDate || activeAppointmentDate === todayStr) return allClinicAppointments;

        const merged = [...allClinicAppointments, ...appointmentDateAppointments];
        const uniqueMap = new Map<string, Appointment>();
        merged.forEach(apt => {
            if (!uniqueMap.has(apt.id)) uniqueMap.set(apt.id, apt);
        });
        return Array.from(uniqueMap.values());
    }, [allClinicAppointments, appointmentDateAppointments, activeAppointmentDate, todayStr]);

    return {
        allClinicAppointments,
        allRelevantAppointments,
        isLoadingAppointments,
    };
}
