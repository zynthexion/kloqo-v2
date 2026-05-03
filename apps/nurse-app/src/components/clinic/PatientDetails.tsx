'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { Appointment } from '@kloqo/shared';

type PatientDetailsProps = {
  appt: Appointment;
  isSwiping: boolean;
};

export function PatientDetails({ appt, isSwiping }: PatientDetailsProps) {
  return (
    <div className="mt-2 flex items-center justify-between">
      <div>
        <h4 className={cn("font-black text-lg tracking-tight leading-tight", isSwiping ? "text-white" : "text-slate-900")}>
          {appt.patientName}
        </h4>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[10px] font-bold uppercase", isSwiping ? "text-white/60" : "text-slate-400")}>
            {appt.sex}, {appt.age}y
          </span>
          {appt.communicationPhone && (
            <>
              <div className={cn("w-1 h-1 rounded-full", isSwiping ? "bg-white/20" : "bg-slate-200")} />
              <span className={cn("text-[10px] font-bold", isSwiping ? "text-white/60" : "text-slate-400")}>
                {appt.communicationPhone}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end">
        <div className={cn("text-2xl font-black tracking-tighter leading-none", isSwiping ? "text-white" : "text-slate-900")}>
          #{appt.tokenNumber?.split('-')[1] || appt.tokenNumber}
        </div>
        <span className={cn("text-[8px] font-black uppercase tracking-[0.2em] mt-1", isSwiping ? "text-white/40" : "text-slate-300")}>TOKEN</span>
      </div>
    </div>
  );
}
