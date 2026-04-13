'use client';

import { useMemo } from 'react';
import { format, parseISO, addMinutes, differenceInMinutes } from 'date-fns';
import type { Doctor } from '@kloqo/shared';

export type BreakInterval = {
    start: Date;
    end: Date;
};

export function buildBreakIntervals(doctor: Doctor | null, referenceDate: Date | null): BreakInterval[] {
    if (!doctor?.breakPeriods || !referenceDate) return [];

    const dateKey = format(referenceDate, 'd MMMM yyyy');
    const isoDateKey = format(referenceDate, 'yyyy-MM-dd');
    const shortDateKey = format(referenceDate, 'd MMM yyyy');

    const breaksForDay = doctor.breakPeriods[dateKey] || doctor.breakPeriods[isoDateKey] || doctor.breakPeriods[shortDateKey];

    if (!breaksForDay || !Array.isArray(breaksForDay)) {
        return [];
    }

    const intervals: BreakInterval[] = [];

    for (const breakPeriod of breaksForDay) {
        try {
            const breakStart = typeof breakPeriod.startTime === 'string'
                ? parseISO(breakPeriod.startTime)
                : new Date(breakPeriod.startTime);
            const breakEnd = typeof breakPeriod.endTime === 'string'
                ? parseISO(breakPeriod.endTime)
                : new Date(breakPeriod.endTime);

            if (!isNaN(breakStart.getTime()) && !isNaN(breakEnd.getTime())) {
                intervals.push({ start: breakStart, end: breakEnd });
            }
        } catch (error) {
            console.warn('Error parsing break period:', error);
        }
    }

    return intervals;
}

export function applyBreakOffsets(originalTime: Date, intervals: BreakInterval[]): Date {
    return intervals.reduce((acc, interval) => {
        if (acc.getTime() >= interval.start.getTime()) {
            return addMinutes(acc, differenceInMinutes(interval.end, interval.start));
        }
        return acc;
    }, new Date(originalTime));
}

export function useBreakLogic(doctor: Doctor | null, selectedDate: Date) {
    const breakIntervals = useMemo(() => buildBreakIntervals(doctor, selectedDate), [doctor, selectedDate]);
    
    return {
        breakIntervals,
        applyOffsets: (time: Date) => applyBreakOffsets(time, breakIntervals)
    };
}
