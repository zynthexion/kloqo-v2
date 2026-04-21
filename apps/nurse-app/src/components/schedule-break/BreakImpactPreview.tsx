import React from 'react';
import { Users, Timer, Coffee, CheckCircle2 } from 'lucide-react';
import { DryRunResult } from '@/hooks/useScheduleBreak';
import { cn } from '@/lib/utils';

interface BreakImpactPreviewProps {
  previewResult: DryRunResult | null;
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export const BreakImpactPreview: React.FC<BreakImpactPreviewProps> = ({ previewResult }) => {
  if (!previewResult) return null;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-36 font-pt-sans">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-3xl p-4 border-2 border-slate-100 text-center shadow-sm">
          <Users className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-slate-800">{previewResult.shiftedCount}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Shifted</p>
        </div>
        <div className="bg-white rounded-3xl p-4 border-2 border-slate-100 text-center shadow-sm">
          <Timer className="h-5 w-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-slate-800">{previewResult.delayMinutes}m</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Day Delay</p>
        </div>
        <div className="bg-white rounded-3xl p-4 border-2 border-slate-100 text-center shadow-sm">
          <Coffee className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-slate-800">{previewResult.ghostsCreated}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Blocked</p>
        </div>
      </div>

      {/* Detail list */}
      <div className="bg-white rounded-[2rem] border-2 border-slate-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50">
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Shifted Token Records</h3>
        </div>
        {previewResult.preview.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {previewResult.preview.map((entry, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100 shadow-inner">
                    <span className="text-[10px] font-black text-amber-600">#{entry.tokenNumber}</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 leading-tight">
                      {formatTime(entry.oldTime)} <span className="mx-1 opacity-20">→</span> {formatTime(entry.newTime)}
                    </p>
                    <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-tight">+{entry.deltaMinutes} min delay</p>
                  </div>
                </div>
                <div className={cn(
                  "text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter",
                  entry.deltaMinutes >= 30 ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"
                )}>
                  {entry.deltaMinutes >= 30 ? 'CRITICAL' : 'IMPACT'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50/30">
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">No major delays predicted</p>
          </div>
        )}
      </div>

      {previewResult.delayMinutes === 0 && (
        <div className="bg-emerald-50 rounded-2xl border-2 border-emerald-100/50 p-4 flex gap-3 animate-in zoom-in-95">
          <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-emerald-900 font-black tracking-tight leading-none mb-1">Clean Window Found</p>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight leading-relaxed">
              This break is scheduled during a gap. <strong>Zero patient delay.</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
