'use client';

import { Clock, ExternalLink, Download, Check, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Appointment } from '@kloqo/shared';

interface RxCardProps {
  appt: Appointment;
  showActions?: boolean;
  onView: (url: string) => void;
  onDispense: (appt: Appointment) => void;
  onAbandon: (appt: Appointment) => void;
  isModern?: boolean;
}

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  return new Date(val);
}

export function RxCard({ 
  appt, showActions = false, onView, onDispense, onAbandon, isModern 
}: RxCardProps) {
  const completedAt = toDate(appt.completedAt);
  
  return (
    <div className={cn(
      "flex flex-col gap-3 p-4 rounded-2xl border border-slate-100 bg-white shadow-sm",
      isModern && "glass-card border-none"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {appt.tokenNumber && (
              <span className="text-xs font-black text-theme-blue bg-blue-50 px-2 py-0.5 rounded-full">
                #{appt.tokenNumber}
              </span>
            )}
            <span className={cn(
              "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
              appt.pharmacyStatus === 'dispensed' ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            )}>
              {appt.pharmacyStatus === 'dispensed' ? 'Dispensed' : 'Pending'}
            </span>
          </div>
          <p className="font-bold text-slate-800 text-base">{appt.patientName}</p>
          <p className="text-sm text-slate-500">Dr. {appt.doctorName}</p>
        </div>
        {completedAt && (
          <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0 mt-1">
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(completedAt, { addSuffix: true })}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onView(appt.prescriptionUrl || '')}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all"
        >
          <ExternalLink className="h-4 w-4" /> View Rx
        </button>
        <a
          href={appt.prescriptionUrl}
          download target="_blank" rel="noreferrer"
          className="flex items-center justify-center p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
        >
          <Download className="h-4 w-4" />
        </a>
        {showActions && (
          <>
            <button
              onClick={() => onDispense(appt)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-all"
            >
              <Check className="h-4 w-4" /> Dispensed
            </button>
            <button
              onClick={() => onAbandon(appt)}
              className="flex items-center justify-center p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-all"
              title="Mark as abandoned"
            >
              <AlertTriangle className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
