import React from 'react';
import { X, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Appointment } from '@kloqo/shared';
import { cn } from '@/lib/utils';

const ABANDON_REASONS = [
  'Patient requested printout / Buying elsewhere',
  'Medicine out of stock',
  'Patient refused (Too expensive)',
  'Patient left without visiting pharmacy',
];

interface DispenseModalProps {
  target: Appointment | null;
  billValue: string;
  setBillValue: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  isDispensing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const DispenseModal: React.FC<DispenseModalProps> = ({
  target, billValue, setBillValue, notes, setNotes, isDispensing, onConfirm, onClose
}) => {
  if (!target) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <Check className="h-6 w-6 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Complete Fulfillment</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
            <X className="h-6 w-6 text-slate-400" />
          </button>
        </div>
        
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
           <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center font-black text-theme-blue shadow-sm border border-slate-100">
             #{target.tokenNumber || '---'}
           </div>
           <div>
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">Patient Name</p>
             <p className="text-lg font-black text-slate-800">{target.patientName}</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">TOTAL BILL (₹)</label>
            <div className="flex items-center gap-3 border-2 border-slate-100 rounded-2xl px-5 py-4 bg-slate-50 focus-within:border-theme-blue/30 focus-within:ring-4 focus-within:ring-theme-blue/5 transition-all">
              <span className="text-slate-400 font-bold text-xl">₹</span>
              <input
                type="number"
                value={billValue}
                onChange={e => setBillValue(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent text-2xl font-black text-slate-900 outline-none placeholder:opacity-30"
                autoFocus
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest leading-none">INTERNAL NOTES</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., Stock out of drug X..."
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 outline-none focus:border-theme-blue/30 focus:ring-4 focus:ring-theme-blue/5 h-16 resize-none"
            />
          </div>
        </div>

        <button
          onClick={onConfirm}
          disabled={isDispensing}
          className="w-full py-5 bg-theme-blue text-white font-black rounded-3xl text-sm uppercase tracking-[0.2em] shadow-xl shadow-theme-blue/30 active:scale-95 transition-all"
        >
          {isDispensing ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Finalize & Close Order'}
        </button>
      </div>
    </div>
  );
};

interface AbandonModalProps {
  target: Appointment | null;
  reason: string;
  setReason: (r: string) => void;
  isAbandoning: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const AbandonModal: React.FC<AbandonModalProps> = ({
  target, reason, setReason, isAbandoning, onConfirm, onClose
}) => {
  if (!target) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-rose-50 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-rose-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Abandon Reason</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
            <X className="h-6 w-6 text-slate-400" />
          </button>
        </div>

        <div className="space-y-2">
          {ABANDON_REASONS.map(r => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn(
                "w-full text-left px-5 py-4 rounded-2xl border-2 font-bold text-sm transition-all flex items-center justify-between group",
                reason === r
                  ? "border-rose-400 bg-rose-50 text-rose-700"
                  : "border-slate-100 text-slate-500 hover:border-rose-200 hover:bg-rose-50/50"
              )}
            >
              {r}
              <div className={cn(
                "h-2 w-2 rounded-full transition-all",
                reason === r ? "bg-rose-500 scale-150" : "bg-slate-200"
              )} />
            </button>
          ))}
        </div>

        <button
          onClick={onConfirm}
          disabled={!reason || isAbandoning}
          className="w-full py-5 bg-rose-500 text-white font-black rounded-3xl text-sm uppercase tracking-[0.2em] shadow-xl shadow-rose-500/30 active:scale-95 transition-all disabled:opacity-50"
        >
          {isAbandoning ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Log Abandonment'}
        </button>
      </div>
    </div>
  );
};
