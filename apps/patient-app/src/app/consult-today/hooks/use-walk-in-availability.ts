import { useMemo } from 'react';
import { isBefore, isAfter, subMinutes, isWithinInterval, addMinutes, differenceInMinutes } from 'date-fns';
import { parseTime } from '@/lib/utils';
import { getSessionEnd, getClinicNow, getClinicDayOfWeek } from '@kloqo/shared-core';
import type { Doctor } from '@kloqo/shared';

export function useWalkInAvailability(clinicTokenDistribution?: 'classic' | 'advanced') {

    const getWalkInAvailabilityState = (doctor: any): { state: 'available' | 'waiting' | 'closed', startTime?: Date } => {
        // 1. Backend as Source of Truth: If session is active (including sticky/overtime), return available.
        if (doctor.isSessionActive) {
            return { state: 'available' };
        }

        // 2. Local Gate for 'Waiting' state: Handle the pre-start window.
        if (!doctor.availabilitySlots?.length) return { state: 'closed' };

        const now = getClinicNow();
        const todayDay = getClinicDayOfWeek(now);
        const todaysAvailability = doctor.availabilitySlots.find((s: any) => s.day === todayDay);

        if (!todaysAvailability || !todaysAvailability.timeSlots?.length) return { state: 'closed' };

        // Check if we are in the "Waiting" zone for any upcoming session today
        for (let i = 0; i < todaysAvailability.timeSlots.length; i++) {
            const session = todaysAvailability.timeSlots[i];
            const startTime = parseTime(session.from, now);
            
            // The "Hoarding Prevention" window: Registering opens exactly 30 minutes before session starts.
            const walkInOpenTime = subMinutes(startTime, 30);
            
            // If we are before the 30-minute window, show 'waiting'
            if (isBefore(now, walkInOpenTime) && isBefore(now, startTime)) {
                return { state: 'waiting', startTime };
            }
        }

        return { state: 'closed' };
    };

    const isWalkInAvailable = useMemo(() => {
        return (doctor: any): boolean => {
            return getWalkInAvailabilityState(doctor).state === 'available';
        };
    }, []);

    return {
        getWalkInAvailabilityState,
        isWalkInAvailable
    };
}
