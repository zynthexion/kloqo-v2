'use client';

import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarDays } from 'lucide-react';
import { getClinicNow } from '@kloqo/shared-core';

interface DateSelectionProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  dates: Date[];
}

export function DateSelection({ selectedDate, setSelectedDate, dates }: DateSelectionProps) {
  return (
    <div className="p-4 bg-white border-b shadow-sm relative z-10">
      <div className="flex justify-between items-center mb-4 px-2">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-theme-blue" />
          {format(selectedDate, 'MMMM yyyy')}
        </h2>
      </div>
      
      <div className="flex gap-2 pb-2 -mx-1 px-1 overflow-x-auto scrollbar-hide">
        {dates.map((date, idx) => {
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, getClinicNow());
          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(date)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[64px] p-4 rounded-3xl transition-all border-2",
                isSelected 
                  ? "bg-theme-blue border-theme-blue text-white shadow-xl shadow-theme-blue/20 scale-105" 
                  : "bg-slate-50 border-slate-50 text-slate-600 hover:bg-slate-100/80"
              )}
            >
              <span className={cn("text-[10px] font-black uppercase mb-1", isSelected ? "text-blue-100" : "text-slate-400")}>
                {format(date, 'EEE')}
              </span>
              <span className="text-xl font-black leading-none">{format(date, 'dd')}</span>
              {isToday && (
                <div className={cn("w-1.5 h-1.5 rounded-full mt-2", isSelected ? "bg-white" : "bg-theme-blue")} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
