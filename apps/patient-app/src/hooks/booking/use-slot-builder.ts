'use client';

import { useMemo, useCallback } from 'react';
import { format, addMinutes, isBefore, isAfter, subMinutes, differenceInMinutes, differenceInHours, isSameDay } from 'date-fns';
import { parseTime } from '@/lib/utils';
import { isSlotBlockedByLeave } from '@kloqo/shared-core';
import type { Doctor, Appointment, Slot, SessionSlots, SubsessionSlots } from '@kloqo/shared';
import { buildBreakIntervals, applyBreakOffsets } from './use-break-logic';

export function useSlotBuilder({
    doctor,
    selectedDate,
    allBookedSlots,
    currentTime,
    isAdvanceCapacityReached,
    t,
    language
}: {
    doctor: Doctor | null;
    selectedDate: Date;
    allBookedSlots: number[];
    currentTime: Date;
    isAdvanceCapacityReached: boolean;
    t: any;
    language: string;
}) {
    const isSlotBooked = useCallback((slot: Date): boolean => {
        return allBookedSlots.includes(slot.getTime());
    }, [allBookedSlots]);

    const sessionSlots = useMemo((): SessionSlots[] => {
        if (!doctor || isAdvanceCapacityReached) return [];

        const dayOfWeek = format(selectedDate, 'EEEE');
        const availabilityForDay = (doctor.availabilitySlots || []).find(slot => slot.day === dayOfWeek);
        if (!availabilityForDay) return [];

        const getSlotWithStatus = (time: Date, slotIndex: number): Slot => ({
            time,
            status: isSlotBooked(time) ? 'booked' : 'available',
        });

        const consultationTime = doctor.averageConsultingTime || 15;
        const now = currentTime;
        let globalSlotIndex = 0;
        const allSlotsForDay: { time: Date; sessionIndex: number; globalSlotIndex: number }[] = [];
        const reservedSlotsBySession = new Map<number, Set<number>>();

        // Pre-calculate reserved slots for walk-ins
        availabilityForDay.timeSlots.forEach((session, sessionIndex) => {
            let slotCurrentTime = parseTime(session.from, selectedDate);
            let endTime = parseTime(session.to, selectedDate);

            const dateKey = format(selectedDate, 'd MMMM yyyy');
            const extension = doctor.availabilityExtensions?.[dateKey]?.sessions?.find((s: any) => s.sessionIndex === sessionIndex);
            if (extension?.newEndTime && isAfter(parseTime(extension.newEndTime, selectedDate), endTime)) {
                endTime = parseTime(extension.newEndTime, selectedDate);
            }

            const futureSessionSlots: number[] = [];
            while (isBefore(slotCurrentTime, endTime)) {
                const slotTime = new Date(slotCurrentTime);
                allSlotsForDay.push({ time: slotTime, sessionIndex, globalSlotIndex });

                if ((isAfter(slotTime, now) || slotTime.getTime() >= now.getTime()) && !isSlotBlockedByLeave(doctor, slotTime)) {
                    futureSessionSlots.push(globalSlotIndex);
                }
                slotCurrentTime = addMinutes(slotCurrentTime, consultationTime);
                globalSlotIndex++;
            }

            if (futureSessionSlots.length > 0) {
                const count = futureSessionSlots.length;
                const reserve = Math.ceil(count * 0.15);
                const start = count - reserve;
                const reserved = new Set<number>();
                for (let i = start; i < count; i++) reserved.add(futureSessionSlots[i]);
                reservedSlotsBySession.set(sessionIndex, reserved);
            }
        });

        // Map into session-level view
        return availabilityForDay.timeSlots.map((session, sessionIndex) => {
            const allPossibleSlots: Date[] = [];
            let slotCurrentTime = parseTime(session.from, selectedDate);
            let endTime = parseTime(session.to, selectedDate);

            const dateKey = format(selectedDate, 'd MMMM yyyy');
            const extension = doctor.availabilityExtensions?.[dateKey]?.sessions?.find((s: any) => s.sessionIndex === sessionIndex);
            if (extension?.newEndTime && isAfter(parseTime(extension.newEndTime, selectedDate), endTime)) {
                endTime = parseTime(extension.newEndTime, selectedDate);
            }

            while (isBefore(slotCurrentTime, endTime)) {
                allPossibleSlots.push(new Date(slotCurrentTime));
                slotCurrentTime = addMinutes(slotCurrentTime, consultationTime);
            }

            const sessionReservedSlots = reservedSlotsBySession.get(sessionIndex) || new Set<number>();
            let processedSlots = allPossibleSlots
                .filter(slot => !isSlotBlockedByLeave(doctor, slot))
                .map(slot => {
                    const info = allSlotsForDay.find(s => s.time.getTime() === slot.getTime() && s.sessionIndex === sessionIndex);
                    const globalIdx = info?.globalSlotIndex ?? -1;
                    const slotObj = getSlotWithStatus(slot, globalIdx);
                    if (sessionReservedSlots.has(globalIdx) && slotObj.status === 'available') {
                        return { ...slotObj, status: 'reserved' as const };
                    }
                    return slotObj;
                });

            // Filters
            processedSlots = processedSlots.filter(s => !isBefore(s.time, now));
            if (isSameDay(selectedDate, currentTime)) {
                processedSlots = processedSlots.filter(s => !isBefore(s.time, addMinutes(now, 30)));
            }
            processedSlots = processedSlots.filter(s => {
                const info = allSlotsForDay.find(i => i.time.getTime() === s.time.getTime() && i.sessionIndex === sessionIndex);
                return !sessionReservedSlots.has(info?.globalSlotIndex ?? -1);
            });

            // Grouping into subsessions
            const breakIntervals = buildBreakIntervals(doctor, selectedDate);
            const subsessions: SubsessionSlots[] = [];
            let subStart = parseTime(session.from, selectedDate);
            const finalEnd = endTime;

            while (isBefore(subStart, finalEnd)) {
                const subEnd = isBefore(addMinutes(subStart, 120), finalEnd) ? addMinutes(subStart, 120) : finalEnd;
                const subSlots = processedSlots.filter(s => s.time.getTime() >= subStart.getTime() && s.time.getTime() < subEnd.getTime());

                if (subSlots.length > 0) {
                    const adjStart = applyBreakOffsets(subStart, breakIntervals);
                    const startBasis = subSlots.find(s => s.status === 'available')?.time || adjStart;
                    const subTitle = `${format(subMinutes(startBasis, 15), 'hh:mm a')} - ${format(subMinutes(subEnd, 15), 'hh:mm a')}`;
                    subsessions.push({ title: subTitle, slots: subSlots });
                }
                subStart = subEnd;
            }

            const sStart = parseTime(session.from, selectedDate);
            const sEnd = parseTime(session.to, selectedDate);
            const sBreaks = breakIntervals.filter(i => i.start < sEnd && i.end > sStart);
            let sTitle = `${t.bookAppointment.session} ${sessionIndex + 1} (${format(sStart, 'hh:mm a')} - ${format(sEnd, 'hh:mm a')})`;
            if (sBreaks.length > 0) {
                sTitle += ` [Break: ${sBreaks.map(i => `${format(i.start, 'hh:mm a')} - ${format(i.end, 'hh:mm a')}`).join(', ')}]`;
            }

            return { title: sTitle, subsessions };
        }).filter(s => s.subsessions.length > 0);
    }, [doctor, selectedDate, isSlotBooked, t, language, currentTime, isAdvanceCapacityReached]);

    const totalAvailableSlots = useMemo(() => {
        return sessionSlots.reduce((total, session) => {
            return total + session.subsessions.reduce((subtotal, sub) => {
                return subtotal + sub.slots.filter(s => s.status === 'available').length;
            }, 0);
        }, 0);
    }, [sessionSlots]);

    return { sessionSlots, totalAvailableSlots, isSlotBooked };
}
