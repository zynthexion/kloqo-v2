import React from 'react';
import { 
  ExternalLink, Download, Printer, 
  Check, AlertTriangle, Clock, UserCircle 
} from 'lucide-react';
import { Appointment } from '@kloqo/shared';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface PrescriptionCardProps {
  appt: Appointment;
  showActions?: boolean;
  isModern: boolean;
  onView: (url: string) => void;
  onPrint: (appt: Appointment) => void;
  onDispense: (appt: Appointment) => void;
  onAbandon: (appt: Appointment) => void;
}

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export const PrescriptionCard: React.FC<PrescriptionCardProps> = ({
  appt,
  showActions = false,
  isModern,
  onView,
  onPrint,
  onDispense,
  onAbandon
}) => {
  const completedAt = toDate(appt.completedAt);
  
  return (
    <div className={cn(
      "flex flex-col gap-4 p-5 rounded-3xl border border-slate-100 bg-white shadow-sm transition-all duration-300",
      "hover:shadow-2xl hover:-translate-y-1 hover:border-theme-blue/20 group",
      isModern && "glass-card border-none"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {appt.tokenNumber && (
              <span className="text-[10px] font-black text-theme-blue bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-tighter">
                Token #{appt.tokenNumber}
              </span>
            )}
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
              appt.pharmacyStatus === 'dispensed' ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            )}>
              <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", appt.pharmacyStatus === 'dispensed' ? "bg-emerald-500" : "bg-amber-500")} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {appt.pharmacyStatus === 'dispensed' ? 'Dispensed' : 'Pending'}
              </span>
            </div>
          </div>
          <h3 className="font-black text-slate-800 text-lg leading-tight truncate group-hover:text-theme-blue transition-colors">
            {appt.patientName}
          </h3>
          <p className="text-sm text-slate-500 font-medium flex items-center gap-1 mt-0.5">
            <UserCircle className="h-3 w-3 opacity-40 lowercase" /> Dr. {appt.doctorName}
          </p>
        </div>
        {completedAt && !isNaN(completedAt.getTime()) && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(completedAt, { addSuffix: true })}</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
        <button
          onClick={() => onView(appt.prescriptionUrl || '')}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all ring-1 ring-slate-200/50"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View Rx
        </button>
        
        <div className="flex gap-2">
          <a
            href={appt.prescriptionUrl}
            download target="_blank" rel="noreferrer"
            className="flex-1 flex items-center justify-center p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all ring-1 ring-slate-200/50"
            title="Download Original"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={() => onPrint(appt)}
            className="flex-1 flex items-center justify-center p-2.5 rounded-2xl bg-theme-blue/10 hover:bg-theme-blue/20 text-theme-blue transition-all"
            title="Branded Print"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showActions && (
        <div className="flex gap-2">
          <button
            onClick={() => onDispense(appt)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Check className="h-4 w-4" /> COMPLETE FULFILLMENT
          </button>
          <button
            onClick={() => onAbandon(appt)}
            className="flex items-center justify-center p-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-500 transition-all"
            title="Mark as abandoned"
          >
            <AlertTriangle className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
