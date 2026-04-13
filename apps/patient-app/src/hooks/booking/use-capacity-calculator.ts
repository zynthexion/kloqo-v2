'use client';

import { useMemo } from 'react';
import { format, isBefore, isAfter, addMinutes } from 'date-fns';
import { parseTime } from '@/lib/utils';
import { isSlotBlockedByLeave } from '@kloqo/shared-core';
import type { Doctor, Appointment } from '@kloqo/shared';

export function useCapacityCalculator({
    doctor,
    selectedDate,
    allAppointments,
    currentTime
}: {
    doctor: Doctor | null;
    selectedDate: Date;
    allAppointments: Appointment[];
    currentTime: Date;
}) {
    return useMemo(() => {
        if (!doctor) return { isAdvanceCapacityReached: false, maximumAdvanceTokens: 0, activeAdvanceCount: 0, totalDailySlots: 0 };

        const dayOfWeek = format(selectedDate, 'EEEE');
        const availabilityForDay = doctor.availabilitySlots?.find(slot => slot.day === dayOfWeek);
        if (!availabilityForDay?.timeSlots?.length) return { isAdvanceCapacityReached: false, maximumAdvanceTokens: 0, activeAdvanceCount: 0, totalDailySlots: 0 };

        const slotDuration = doctor.averageConsultingTime || 15;
        const now = currentTime;
        const dateKey = format(selectedDate, 'd MMMM yyyy');
        
        const slotsBySession: Array<{ sessionIndex: number; slotCount: number }> = [];
        let totalDailySlots = 0;

        // 1. Calculate possible slots per session (factoring in extensions/leaks)
        availabilityForDay.timeSlots.forEach((session, sessionIndex) => {
            let sessionCurrentTime = parseTime(session.from, selectedDate);
            const originalSessionEnd = parseTime(session.to, selectedDate);
            let sessionEnd = originalSessionEnd;

            const extensions = doctor.availabilityExtensions?.[dateKey];
            if (extensions?.sessions && Array.isArray(extensions.sessions)) {
                const sessionExtension = extensions.sessions.find((s: any) => s.sessionIndex === sessionIndex);
                if (sessionExtension?.breaks && sessionExtension.breaks.length > 0 && sessionExtension?.newEndTime) {
                    sessionEnd = parseTime(sessionExtension.newEndTime, selectedDate);
                }
            }

            let futureSlotCount = 0;
            let sessionTotalSlotCount = 0;

            while (isBefore(sessionCurrentTime, sessionEnd)) {
                const slotTime = new Date(sessionCurrentTime);
                const isBlocked = isSlotBlockedByLeave(doctor, slotTime);

                if (!isBlocked && (isAfter(slotTime, now) || slotTime.getTime() >= now.getTime())) {
                    futureSlotCount += 1;
                }
                sessionTotalSlotCount += 1;
                sessionCurrentTime = addMinutes(sessionCurrentTime, slotDuration);
            }

            if (futureSlotCount > 0) {
                slotsBySession.push({ sessionIndex, slotCount: futureSlotCount });
            }
            totalDailySlots += sessionTotalSlotCount;
        });

        // 2. Calculate Maximum Advance Capacity (85% of future slots)
        let maximumAdvanceTokens = 0;
        slotsBySession.forEach(({ slotCount }) => {
            const sessionMinimumWalkInReserve = slotCount > 0 ? Math.ceil(slotCount * 0.15) : 0;
            const sessionAdvanceCapacity = Math.max(slotCount - sessionMinimumWalkInReserve, 0);
            maximumAdvanceTokens += sessionAdvanceCapacity;
        });

        // 3. Count active bookings that consume this capacity
        const formattedDate = format(selectedDate, 'd MMMM yyyy');
        const activeAdvanceAppointments = allAppointments.filter((appointment: Appointment) => {
            const appointmentTime = parseTime(appointment.time || '', selectedDate);
            const isFutureAppointment = isAfter(appointmentTime, now) || appointmentTime.getTime() >= now.getTime();
            const isValidSlot = typeof appointment.slotIndex === 'number' && appointment.slotIndex < totalDailySlots;

            let isWithinSessionBoundary = false;
            if (typeof appointment.sessionIndex === 'number') {
                const sessionForAppt = availabilityForDay.timeSlots[appointment.sessionIndex];
                if (sessionForAppt) {
                    const originalSessionEnd = parseTime(sessionForAppt.to, selectedDate);
                    let sessionBoundary = originalSessionEnd;
                    const extensions = doctor.availabilityExtensions?.[dateKey];
                    if (extensions?.sessions) {
                        const sessExt = extensions.sessions.find((s: any) => s.sessionIndex === appointment.sessionIndex);
                        if (sessExt?.breaks && sessExt.breaks.length > 0 && sessExt?.newEndTime) {
                            sessionBoundary = parseTime(sessExt.newEndTime, selectedDate);
                        }
                    }
                    const apptEnd = addMinutes(appointmentTime, doctor.averageConsultingTime || 15);
                    isWithinSessionBoundary = apptEnd <= sessionBoundary;
                }
            }

            return (
                appointment.bookedVia !== 'Walk-in' &&
                appointment.date === formattedDate &&
                isFutureAppointment &&
                isValidSlot &&
                isWithinSessionBoundary &&
                (appointment.status === 'Pending' || appointment.status === 'Confirmed') &&
                !appointment.cancelledByBreak
            );
        });

        const activeAdvanceCount = activeAdvanceAppointments.length;
        const isAdvanceCapacityReached = activeAdvanceCount >= maximumAdvanceTokens && maximumAdvanceTokens > 0;

        return {
            isAdvanceCapacityReached,
            maximumAdvanceTokens,
            activeAdvanceCount,
            totalDailySlots,
            availabilityForDay
        };
    }, [doctor, selectedDate, allAppointments, currentTime]);
}
