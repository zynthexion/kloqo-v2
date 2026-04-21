import React, { useRef, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface AppointmentDatePickerProps {
  dates: Date[];
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  isTablet?: boolean;
}

export const AppointmentDatePicker: React.FC<AppointmentDatePickerProps> = ({
  dates,
  selectedDate,
  onSelectDate,
  isTablet = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-center the selected date
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [selectedDate]);

  const displayDates = isTablet ? dates.slice(85, 125) : dates;

  return (
    <div className={cn("p-4 bg-white", isTablet ? "p-8 rounded-[2.5rem] shadow-premium border border-slate-50 space-y-6" : "border-b pb-6")}>
      <div className="flex justify-between items-center mb-5 px-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 group transition-all">
              <div className="bg-primary/10 p-2 rounded-xl text-primary group-hover:bg-primary/20 transition-colors">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div className="text-left">
                <h2 className="font-black text-sm text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                  {format(selectedDate, 'MMMM yyyy')}
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-primary transition-colors" />
                </h2>
                {!isTablet && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Change Month</p>}
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-none shadow-premium rounded-2xl" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && onSelectDate(d)}
              initialFocus
              className="rounded-2xl border border-slate-100"
            />
          </PopoverContent>
        </Popover>

        <button
          onClick={() => onSelectDate(new Date())}
          className={cn(
            "text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95",
            isTablet 
              ? "bg-slate-900 px-5 py-2.5 rounded-xl text-white hover:bg-slate-800" 
              : "bg-blue-50 px-4 py-2 rounded-full text-theme-blue hover:bg-theme-blue hover:text-white"
          )}
        >
          Today
        </button>
      </div>

      <div 
        ref={containerRef}
        className={cn(
          "no-scrollbar",
          isTablet 
            ? "grid grid-cols-5 gap-3" 
            : "flex gap-2 px-1 overflow-x-auto snap-x scroll-px-4"
        )}
      >
        {displayDates.map((d, index) => {
          const isSelected = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, new Date());
          
          return (
            <button
              key={index}
              ref={isSelected ? activeRef : null}
              onClick={() => onSelectDate(d)}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-[1.25rem] gap-0.5 transition-all duration-500 border-2 min-w-[58px] snap-center',
                isSelected
                  ? 'bg-theme-blue text-white border-theme-blue shadow-[0_8px_16px_-4px_rgba(37,99,235,0.3)] scale-110 z-10'
                  : 'bg-slate-50 border-slate-50 text-slate-600 hover:bg-white hover:border-slate-200 hover:shadow-sm',
                isToday && !isSelected && 'border-theme-blue/30 border-dashed bg-blue-50/50',
                isTablet && "p-4"
              )}
            >
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-tighter', 
                isSelected ? 'text-blue-100' : 'text-slate-400',
                isTablet && "text-[9px]"
              )}>
                {format(d, 'EEE')}
              </span>
              <span className={cn(
                "text-lg font-black leading-tight", 
                isSelected ? "text-white" : "text-slate-900",
                isTablet && "text-base"
              )}>
                {format(d, 'dd')}
              </span>
              {isToday && (
                <div className={cn('w-1.5 h-1.5 rounded-full mt-0.5', isSelected ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,1)]' : 'bg-theme-blue animate-pulse')} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
