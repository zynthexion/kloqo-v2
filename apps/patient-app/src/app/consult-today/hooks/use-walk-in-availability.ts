import { useMemo } from 'react';
import { isBefore, isAfter, subMinutes, isWithinInterval, addMinutes, differenceInMinutes } from 'date-fns';
import { parseTime } from '@/lib/utils';
import { getSessionEnd, getClinicNow, getClinicDayOfWeek } from '@kloqo/shared-core';
import type { Doctor } from '@kloqo/shared';

export function useWalkInAvailability(clinicTokenDistribution?: 'classic' | 'advanced') {

    const getWalkInAvailabilityState = (doctor: Doctor): { state: 'available' | 'waiting' | 'closed', startTime?: Date } => {
        if (!doctor.availabilitySlots?.length) return { state: 'closed' };

        const now = getClinicNow();
        const todayDay = getClinicDayOfWeek(now);
        const todaysAvailability = doctor.availabilitySlots.find(s => s.day === todayDay);

        if (!todaysAvailability || !todaysAvailability.timeSlots || todaysAvailability.timeSlots.length === 0) return { state: 'closed' };

        const isClassic = clinicTokenDistribution === 'classic';

        // Check each session
        for (let i = 0; i < todaysAvailability.timeSlots.length; i++) {
            const session = todaysAvailability.timeSlots[i];
            const startTime = parseTime(session.from, now);
            const effectiveEnd = getSessionEnd(doctor, now, i) || parseTime(session.to, now);

            if (isClassic) {
                // S0 is always open until end
                if (i === 0 && isBefore(now, effectiveEnd)) {
                    return { state: 'available' };
                }

                // Sticky Logic for past sessions (Check if technically available via force book)
                if (isAfter(now, effectiveEnd)) {
                    const nextSession = todaysAvailability.timeSlots[i + 1];
                    if (nextSession) {
                        const nextStart = parseTime(nextSession.from, now);
                        const gap = differenceInMinutes(nextStart, effectiveEnd);
                        if (gap > 60) {
                            // Large Gap: Sticky until 30m Fail-safe
                            if (isBefore(now, subMinutes(nextStart, 30))) {
                                return { state: 'available' };
                            }
                        }
                    } else {
                        // Last session sticky for 4 hours
                        if (isBefore(now, addMinutes(effectiveEnd, 240))) {
                            return { state: 'available' };
                        }
                    }
                }

                // Next session opening
                if (i > 0) {
                    const prevSession = todaysAvailability.timeSlots[i - 1];
                    const prevEnd = getSessionEnd(doctor, now, i - 1) || parseTime(prevSession.to, now);
                    const gapWithPrev = differenceInMinutes(startTime, prevEnd);

                    if (gapWithPrev > 60) {
                        // Large Gap: Lock until 30m before start
                        const failSafeTrigger = subMinutes(startTime, 30);
                        if (isBefore(now, failSafeTrigger) && isAfter(now, prevEnd)) {
                            // This is the "Waiting" zone
                            return { state: 'waiting', startTime };
                        }
                        if (!isBefore(now, failSafeTrigger) && !isAfter(now, effectiveEnd)) {
                            return { state: 'available' };
                        }
                    } else {
                        // Small Gap: Jump immediately when prev ends
                        if (!isBefore(now, prevEnd) && !isAfter(now, effectiveEnd)) {
                            return { state: 'available' };
                        }
                    }
                }
            } else {
                // Advanced: Strict 30m window
                const walkInStartTime = subMinutes(startTime, 30);
                const walkInEndTime = subMinutes(effectiveEnd, 15);
                if (isWithinInterval(now, { start: walkInStartTime, end: walkInEndTime })) {
                    return { state: 'available' };
                }
            }
        }

        return { state: 'closed' };
    };

    const isWalkInAvailable = useMemo(() => {
        return (doctor: Doctor): boolean => {
            return getWalkInAvailabilityState(doctor).state === 'available';
        };
    }, [clinicTokenDistribution]);

    return {
        getWalkInAvailabilityState,
        isWalkInAvailable
    };
}
