'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { displayTime12h, getClinic12hTimeString, parseClinicTime, getClinicNow } from '@kloqo/shared-core';
import { format, subMinutes } from 'date-fns';
import type { Appointment } from '@kloqo/shared';

type AppointmentTimeInfoProps = {
  appt: Appointment;
  index: number;
  showEstimatedTime: boolean;
  isFirstEstimated?: boolean;
  doctorStatus: string;
  estimatedTime?: string;
  currentTime: Date;
  averageConsultingTime: number;
  isSwiping: boolean;
  liveDelay: number;
  gracePeriod: number;
  deadline: Date | null;
};

export function AppointmentTimeInfo({
  appt,
  index,
  showEstimatedTime,
  isFirstEstimated,
  doctorStatus,
  estimatedTime,
  currentTime,
  averageConsultingTime,
  isSwiping,
  liveDelay,
  gracePeriod,
  deadline
}: AppointmentTimeInfoProps) {
  if (showEstimatedTime) {
    if (isFirstEstimated && doctorStatus === 'In') return null;

    const displayTime = estimatedTime 
      ? displayTime12h(estimatedTime) 
      : (index === 0 ? '' : getClinic12hTimeString(new Date(currentTime.getTime() + (averageConsultingTime || 15) * index * 60000)));
    if (!displayTime) return null;

    return (
      <div className="flex flex-col gap-1">
        <Badge variant={isSwiping ? 'default' : 'outline'} className={cn("text-xs w-fit", isSwiping && 'bg-white/20 text-white')}>
          {appt.date && `${appt.date} - `}
          {displayTime}
        </Badge>
        <span className={cn("text-[9px] font-bold uppercase tracking-wider ml-1", isSwiping ? 'text-white/60' : 'text-emerald-600')}>
          Reporting: {format(subMinutes(parseClinicTime(displayTime, getClinicNow()), 15), 'hh:mm a')}
        </span>
        {appt.time && (
          <div className={cn("text-[8px] font-mono font-bold mt-1 tracking-tight text-slate-500", isSwiping && "text-white/60")}>
            [DEBUG] Delay: {liveDelay}m | Grace: {gracePeriod}m | Doc: {doctorStatus} | Deadline: {deadline ? getClinic12hTimeString(deadline) : 'Invalid'}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Badge variant={isSwiping ? 'default' : 'outline'} className={cn("text-xs w-fit", isSwiping && 'bg-white/20 text-white')}>
        {appt.date && `${appt.date} - `}
        {appt.time && displayTime12h(appt.time)}
      </Badge>
      {appt.time && (
        <>
          <span className={cn("text-[9px] font-bold uppercase tracking-wider ml-1", isSwiping ? 'text-white/60' : 'text-emerald-600')}>
            Reporting: {format(subMinutes(parseClinicTime(appt.time, getClinicNow()), 15), 'hh:mm a')}
          </span>
          <div className={cn("text-[8px] font-mono font-bold mt-1 tracking-tight text-slate-500", isSwiping && "text-white/60")}>
            [DEBUG] Delay: {liveDelay}m | Grace: {gracePeriod}m | Doc: {doctorStatus} | Deadline: {deadline ? getClinic12hTimeString(deadline) : 'Invalid'}
          </div>
        </>
      )}
    </div>
  );
}
