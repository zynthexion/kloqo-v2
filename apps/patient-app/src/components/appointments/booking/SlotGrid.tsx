'use client';

import { format, subMinutes } from 'date-fns';
import { Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlotGridProps {
  slots: any[];
  selectedSlot: any | null;
  onSelectSlot: (slot: any) => void;
  doctor: any;
  selectedDate: Date;
}

export function SlotGrid({ slots, selectedSlot, onSelectSlot, doctor, selectedDate }: SlotGridProps) {
  const sessions: Record<number, any[]> = {};
  slots.forEach(slot => {
    if (!sessions[slot.sessionIndex]) sessions[slot.sessionIndex] = [];
    sessions[slot.sessionIndex].push(slot);
  });

  return (
    <div className="space-y-8 pb-32">
      {Object.entries(sessions).map(([sessionIdx, sessionSlots]) => {
        const idx = parseInt(sessionIdx);
        const firstSlot = sessionSlots[0];
        const lastSlot = sessionSlots[sessionSlots.length - 1];
        const arriveByStart = subMinutes(new Date(firstSlot.time), 15);
        const arriveByEnd = subMinutes(new Date(lastSlot.time), 15);

        const sessionDateStr = format(selectedDate, 'd MMMM yyyy');
        const doctorBreaks = doctor?.breakPeriods?.[sessionDateStr] || [];
        const sessionBreaks = doctorBreaks.filter((b: any) => b.sessionIndex === idx);

        let foundFirstAvailable = false;
        const visibleSlots = sessionSlots.filter(slot => {
          if (slot.status === 'available') {
            if (!foundFirstAvailable) {
              foundFirstAvailable = true;
              return true;
            }
            return false;
          }
          return true;
        });

        const isCapacityFull = !sessionSlots.some(s => s.status === 'available');
        if (visibleSlots.length === 0 && !isCapacityFull) return null;

        return (
          <div key={sessionIdx} className="space-y-4">
            <div className="flex flex-col gap-1 px-2">
              <div className="flex items-center gap-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Session {idx + 1} 
                  <span className="ml-2 text-slate-300">
                    ({format(arriveByStart, 'hh:mm a')} - {format(arriveByEnd, 'hh:mm a')})
                  </span>
                </h3>
                <div className="flex-1 h-[1px] bg-slate-100" />
                {isCapacityFull && (
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Capacity Full
                  </span>
                )}
              </div>
              {sessionBreaks.length > 0 && (
                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                  [Break: {sessionBreaks.map((b: any) => `${b.startTimeFormatted} - ${b.endTimeFormatted}`).join(', ')}]
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {visibleSlots.map((slot, sIdx) => {
                const isBooked = slot.status !== 'available';
                const isSelected = selectedSlot?.time === slot.time;
                const slotTime = new Date(slot.time);
                const displayTime = slot.status === 'available' ? subMinutes(slotTime, 15) : slotTime;

                return (
                  <button
                    key={sIdx}
                    disabled={isBooked}
                    onClick={() => onSelectSlot(slot)}
                    className={cn(
                      "relative p-5 rounded-[2rem] border-2 transition-all text-left group",
                      isBooked 
                        ? "bg-slate-50 border-slate-50 grayscale opacity-40 cursor-not-allowed" 
                        : isSelected
                          ? "bg-theme-blue border-theme-blue text-white shadow-2xl shadow-theme-blue/30 scale-105 z-10"
                          : "bg-white border-slate-50 hover:border-theme-blue/30 shadow-sm"
                    )}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className={cn(
                        "p-2 rounded-xl transition-colors",
                        isSelected ? "bg-white/20" : "bg-slate-50 group-hover:bg-theme-blue/5"
                      )}>
                        <Clock className={cn("h-4 w-4", isSelected ? "text-white" : "text-slate-400 group-hover:text-theme-blue")} />
                      </div>
                      {isSelected && <CheckCircle2 className="h-6 w-6 text-white animate-in zoom-in-50" />}
                    </div>
                    
                    <p className="text-2xl font-black leading-none tracking-tight mb-1">
                      {format(displayTime, 'hh:mm')}
                      <span className="text-xs ml-1 opacity-70 uppercase">{format(displayTime, 'a')}</span>
                    </p>
                    
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      isSelected ? "text-blue-100" : "text-slate-400"
                    )}>
                      {slot.status === 'booked' ? 'Booked' : 
                       slot.status === 'reserved' ? 'Reserved' :
                       slot.status === 'leave' ? 'On Leave' : 
                       slot.status === 'past' ? 'Past' : 'Available'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
