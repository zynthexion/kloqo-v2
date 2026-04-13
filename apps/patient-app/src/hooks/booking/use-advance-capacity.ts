'use client';

import { useMemo } from 'react';
import type { Appointment, Doctor } from '@kloqo/shared';
import { differenceInMinutes } from 'date-fns';

export function useAdvanceCapacity({
    doctor,
    sessionIndex,
    appointmentsToday,
    tokenDistribution
}: {
    doctor: Doctor | null;
    sessionIndex: number;
    appointmentsToday: Appointment[];
    tokenDistribution?: 'classic' | 'advanced';
}) {
    const isAdvanceCapacityReached = useMemo(() => {
        if (!doctor?.availabilitySlots || tokenDistribution !== 'advanced') return false;

        const dayAvailability = doctor.availabilitySlots.find(slot => slot.day === 'Monday'); // Template day
        if (!dayAvailability || !dayAvailability.timeSlots[sessionIndex]) return false;

        const session = dayAvailability.timeSlots[sessionIndex];
        const capacity = session.maxAdvanceAppointments || 10; // Default capacity

        const confirmedCount = appointmentsToday.filter(a => a.status === 'Confirmed' && a.sessionIndex === sessionIndex).length;
        const pendingCount = appointmentsToday.filter(a => a.status === 'Pending' && a.sessionIndex === sessionIndex).length;

        return (confirmedCount + pendingCount) >= capacity;
    }, [doctor, sessionIndex, appointmentsToday, tokenDistribution]);

    const remainingCapacity = useMemo(() => {
        if (!doctor?.availabilitySlots || tokenDistribution !== 'advanced') return null;

        const dayAvailability = doctor.availabilitySlots.find(slot => slot.day === 'Monday');
        if (!dayAvailability || !dayAvailability.timeSlots[sessionIndex]) return null;

        const session = dayAvailability.timeSlots[sessionIndex];
        const capacity = session.maxAdvanceAppointments || 10;
        const currentUsage = appointmentsToday.filter(a => 
            (a.status === 'Confirmed' || a.status === 'Pending') && 
            a.sessionIndex === sessionIndex
        ).length;

        return Math.max(0, capacity - currentUsage);
    }, [doctor, sessionIndex, appointmentsToday, tokenDistribution]);

    return {
        isAdvanceCapacityReached,
        remainingCapacity
    };
}
