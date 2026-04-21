import React from 'react';
import { format, isSameDay } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreakDatePickerProps {
  dates: Date[];
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
}

export const BreakDatePicker: React.FC<BreakDatePickerProps> = ({
  dates,
  selectedDate,
  onSelectDate
}) => {
  return (
    <div className="p-4 bg-white border-b mb-4 mx-4 mt-4 rounded-3xl shadow-sm border-slate-100">
      <div className="flex justify-between items-center mb-4 px-2">
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-amber-500" />
          {format(selectedDate, 'MMMM yyyy')}
        </h2>
      </div>
      <div className="flex gap-2 pb-2 px-1 overflow-x-auto no-scrollbar">
        {dates.map((date, idx) => {
          const isSelected = isSameDay(date, selectedDate);
          const isToday    = isSameDay(date, new Date());
          return (
            <button 
              key={idx} 
              onClick={() => onSelectDate(date)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[60px] p-3 rounded-2xl transition-all border-2",
                isSelected
                  ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20 scale-105"
                  : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
              )}
            >
              <span className={cn("text-[10px] font-black uppercase mb-1", isSelected ? "text-amber-100" : "text-slate-400")}>
                {format(date, 'EEE')}
              </span>
              <span className="text-lg font-black leading-none">{format(date, 'dd')}</span>
              {isToday && <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5", isSelected ? "bg-white" : "bg-amber-500")} />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
