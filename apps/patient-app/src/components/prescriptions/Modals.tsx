'use client';

import { X, Loader2, Check, AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Appointment } from '@kloqo/shared';

const ABANDON_REASONS = [
  'Medicine out of stock',
  'Too expensive',
  'Patient left early',
  'Generic substitute taken',
  'Other',
];

interface DispenseModalProps {
  appt: Appointment;
  billValue: string;
  onBillChange: (val: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

export function DispenseModal({ appt, billValue, onBillChange, onConfirm, onClose, isPending }: DispenseModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
      <div className="w-full bg-white rounded-t-3xl p-6 space-y-4 animate-in slide-in-from-bottom-full duration-300">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Confirm Dispense</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500">Patient: <span className="font-bold text-slate-700">{appt.patientName}</span></p>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bill Amount (₹)</label>
          <div className="flex items-center gap-2 border-2 border-slate-100 rounded-2xl px-4 py-3 bg-slate-50 focus-within:border-theme-blue transition-all">
            <span className="text-slate-400 font-black">₹</span>
            <input 
              type="number" value={billValue} onChange={e => onBillChange(e.target.value)} 
              placeholder="0" className="flex-1 bg-transparent text-lg font-black text-slate-800 outline-none" autoFocus 
            />
          </div>
          <p className="text-[10px] font-bold text-slate-400">Optional — used to calculate your pharmacy ROI.</p>
        </div>
        <button 
          onClick={onConfirm} disabled={isPending}
          className="w-full h-16 bg-emerald-500 text-white font-black rounded-2xl text-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
          Finalize & Dispense
        </button>
      </div>
    </div>
  );
}

interface AbandonModalProps {
  appt: Appointment;
  reason: string;
  onReasonSelect: (val: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

export function AbandonModal({ appt, reason, onReasonSelect, onConfirm, onClose, isPending }: AbandonModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
      <div className="w-full bg-white rounded-t-3xl p-6 space-y-4 animate-in slide-in-from-bottom-full duration-300">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Leakage Reason</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-slate-400 font-bold">Help the clinic track lost revenue and improve inventory.</p>
        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {ABANDON_REASONS.map(r => (
            <button 
              key={r} onClick={() => onReasonSelect(r)}
              className={cn(
                "w-full text-left px-4 py-4 rounded-2xl border-2 font-black text-sm transition-all",
                reason === r ? "border-red-500 bg-red-50 text-red-700 shadow-sm" : "border-slate-100 text-slate-500 hover:border-slate-200"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <button 
          onClick={onConfirm} disabled={!reason || isPending}
          className="w-full h-16 bg-red-500 text-white font-black rounded-2xl text-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-red-500/20"
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertTriangle className="h-5 w-5" />}
          Mark as Abandoned
        </button>
      </div>
    </div>
  );
}

interface RxViewerProps {
  url: string;
  onClose: () => void;
}

export function RxViewer({ url, onClose }: RxViewerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4 bg-black/40 backdrop-blur-md">
        <button onClick={onClose} className="text-white font-black text-sm uppercase tracking-widest">✕ Close Preview</button>
        <div className="flex gap-3">
          <a 
            href={url} download target="_blank" rel="noreferrer" 
            className="flex items-center gap-1.5 text-white bg-white/20 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest" 
            onClick={e => e.stopPropagation()}
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button 
              onClick={async e => { e.stopPropagation(); try { await navigator.share({ url: url }); } catch {} }}
              className="flex items-center gap-1.5 text-white bg-white/20 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest"
            >
              Share
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        <img src={url} alt="Prescription" className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-300" />
      </div>
    </div>
  );
}
