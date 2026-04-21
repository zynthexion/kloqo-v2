import React from 'react';
import { format } from 'date-fns';
import { Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreakSlotGridProps {
  slots: any[];
  loadingSlots: boolean;
  selectedRange: string[];
  startSlotId: string | null;
  endSlotId: string | null;
  onSlotClick: (id: string) => void;
}

export const BreakSlotGrid: React.FC<BreakSlotGridProps> = ({
  slots,
  loadingSlots,
  selectedRange,
  startSlotId,
  endSlotId,
  onSlotClick
}) => {
  if (loadingSlots) {
    return (
      <div className="flex flex-col items-center justify-center h-48 py-10">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500 mb-4" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Syncing Schedule...</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-white rounded-3xl border-2 border-dashed border-slate-100 mx-4">
        <Clock className="h-12 w-12 text-slate-200 mb-4" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-6">
          No breakable slots found for this date
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 pb-40">
      {slots.map((slot, idx) => {
        const isSelected = selectedRange.includes(slot.time);
        const isStart    = startSlotId === slot.time;
        const isEnd      = endSlotId   === slot.time;
        const slotTime   = new Date(slot.time);
        return (
          <button 
            key={idx} 
            onClick={() => onSlotClick(slot.time)}
            className={cn(
              "relative p-4 rounded-2xl border-2 transition-all text-left overflow-hidden group",
              isSelected
                ? "bg-amber-500 border-amber-500 text-white shadow-xl shadow-amber-500/20 scale-[1.02]"
                : "bg-white border-slate-100 hover:border-amber-500 shadow-sm"
            )}
          >
            <div className="flex justify-between items-start mb-2">
              <div className={cn("p-1.5 rounded-lg", isSelected ? "bg-white/20" : "bg-slate-100 group-hover:bg-amber-500/10")}>
                <Clock className={cn("h-4 w-4", isSelected ? "text-white" : "text-slate-400 group-hover:text-amber-500")} />
              </div>
              {(isStart || isEnd) && <CheckCircle2 className="h-5 w-5 text-white" />}
            </div>
            <p className="text-lg font-black leading-tight tracking-tight">
              {format(slotTime, 'hh:mm')}
              <span className="text-[10px] ml-0.5 opacity-70 uppercase">{format(slotTime, 'a')}</span>
            </p>
            <p className={cn("text-[10px] font-black uppercase tracking-widest mt-1 opacity-80", isSelected ? "text-amber-100" : "text-slate-400")}>
              {isStart ? 'START WINDOW' : isEnd ? 'END WINDOW' : 'BREAKABLE'}
            </p>
          </button>
        );
      })}
    </div>
  );
};
