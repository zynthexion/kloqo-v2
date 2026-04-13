'use client';

import { useMemo } from 'react';
import { isAfter } from 'date-fns';
import { parseClinicTime } from '@kloqo/shared-core';
import type { Appointment } from '@kloqo/shared';

interface UseAppointmentQueueBuilderProps {
  appointments: Appointment[];
  breaks?: Array<{ id: string; startTime: string; endTime: string; note?: string }>;
  estimatedTimes?: Array<{ appointmentId: string; estimatedTime: string; isFirst: boolean }>;
  currentTime: Date;
}

export function useAppointmentQueueBuilder({
  appointments,
  breaks = [],
  estimatedTimes = [],
  currentTime
}: UseAppointmentQueueBuilderProps) {
  const mixedItems = useMemo(() => {
    let items: Array<{ type: 'appointment' | 'break' | 'session-header'; data: any }> = [];

    const sortedBreaks = [...breaks]
      .filter(b => isAfter(new Date(b.endTime), currentTime))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const getApptTime = (apt: Appointment) => {
      const est = estimatedTimes.find(e => e.appointmentId === apt.id);
      if (est) {
        return parseClinicTime(est.estimatedTime, new Date());
      }
      return new Date(8640000000000000); // Far future
    };

    let breakIndex = 0;
    let lastSessionIndex = -1;

    appointments.forEach(apt => {
      const aptTime = getApptTime(apt);
      const currentSessionIndex = apt.sessionIndex ?? 0;

      // Insert breaks that happen BEFORE this appointment
      while (breakIndex < sortedBreaks.length) {
        const brk = sortedBreaks[breakIndex];
        const brkStart = new Date(brk.startTime);

        if (brkStart.getTime() <= aptTime.getTime()) {
          items.push({ type: 'break', data: brk });
          breakIndex++;
        } else {
          break;
        }
      }

      // Insert session header if session index changed
      if (currentSessionIndex !== lastSessionIndex) {
        items.push({ type: 'session-header', data: { sessionIndex: currentSessionIndex } });
        lastSessionIndex = currentSessionIndex;
      }

      items.push({ type: 'appointment', data: apt });
    });

    // Append remaining breaks
    while (breakIndex < sortedBreaks.length) {
      items.push({ type: 'break', data: sortedBreaks[breakIndex] });
      breakIndex++;
    }

    return items;
  }, [appointments, breaks, estimatedTimes, currentTime]);

  return { mixedItems };
}
