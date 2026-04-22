'use client';

import { format, subMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { Loader2, CalendarDays, Clock, CheckCircle2 } from 'lucide-react';

interface SlotGridProps {
  loading: boolean;
  slots: any[];
  selectedSlot: any | null;
  setSelectedSlot: (slot: any) => void;
  selectedDate: Date;
  doctor: any;
}

export function SlotGrid({ loading, slots, selectedSlot, setSelectedSlot, selectedDate, doctor }: SlotGridProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 py-20">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-theme-blue" />
          <div className="absolute inset-0 bg-theme-blue/20 blur-xl rounded-full animate-pulse" />
        </div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-6">Scanning for open slots...</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-[2rem] border-2 border-dashed border-slate-100 animate-in fade-in zoom-in-95">
        <div className="bg-slate-50 p-6 rounded-full mb-4">
          <CalendarDays className="h-12 w-12 text-slate-200" />
        </div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No slots available</p>
        <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Try a different date above</p>
      </div>
    );
  }

  const firstAvailableSlot = slots.find(slot => slot.status === 'available' && slot.isAvailable);
  if (!firstAvailableSlot) return null;

  const activeSessionIndex = firstAvailableSlot.sessionIndex;
  const sessionSlots = slots.filter(s => s.sessionIndex === activeSessionIndex);
  
  const firstSlot = sessionSlots[0];
  const lastSlot = sessionSlots[sessionSlots.length - 1];
  const arriveByStart = subMinutes(new Date(firstSlot.time), 15);
  const arriveByEnd = subMinutes(new Date(lastSlot.time), 15);

  const sessionDateStr = format(selectedDate, 'd MMMM yyyy');
  const doctorBreaks = doctor?.breakPeriods?.[sessionDateStr] || [];
  const sessionBreaks = doctorBreaks.filter((b: any) => b.sessionIndex === activeSessionIndex);

  const displayTime = subMinutes(new Date(firstAvailableSlot.time), 15);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 px-2">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Next Available <span className="text-blue-500">(Session {activeSessionIndex + 1})</span>
            <span className="ml-2 text-slate-300">
              ({format(arriveByStart, 'hh:mm a')} - {format(arriveByEnd, 'hh:mm a')})
            </span>
          </h3>
          <div className="flex-1 h-[1px] bg-slate-100" />
        </div>
        {sessionBreaks.length > 0 && (
          <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">
            [Break: {sessionBreaks.map((b: any) => `${b.startTimeFormatted} - ${b.endTimeFormatted}`).join(', ')}]
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setSelectedSlot(firstAvailableSlot)}
          className={cn(
            "relative p-5 rounded-[2rem] border-2 transition-all text-left overflow-hidden group bg-theme-blue border-theme-blue text-white shadow-2xl shadow-theme-blue/30 scale-105 z-10"
          )}
        >
          <div className="flex justify-between items-start mb-3">
            <div className="p-2 rounded-xl transition-colors bg-white/20">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <CheckCircle2 className="h-6 w-6 text-white animate-in zoom-in-50" />
          </div>
          
          <p className="text-2xl font-black leading-none tracking-tight mb-1">
            {format(displayTime, 'hh:mm')}
            <span className="text-xs ml-1 opacity-70 uppercase">{format(displayTime, 'a')}</span>
          </p>
          
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">
            Available
          </p>
          
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-[9px] font-black uppercase tracking-widest leading-none text-white/50">
              Reporting
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
