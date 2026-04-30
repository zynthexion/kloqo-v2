'use client';

import React from 'react';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { cn } from '@/lib/utils';
import { Appointment } from '@kloqo/shared';
import { User, Clock, Star } from 'lucide-react';

interface TabletQueueProps {
  onSelect: (appointment: Appointment) => void;
  selectedId?: string;
}

export function TabletQueue({ onSelect, selectedId }: TabletQueueProps) {
  const { data } = useNurseDashboardContext();

  const arrivedQueue = React.useMemo(() => {
    if (!data?.appointments) return [];
    // Only show "arrived" patients (Confirmed or Skipped)
    const filtered = data.appointments.filter(a => ['Confirmed', 'Skipped'].includes(a.status));
    
    // Custom sort: Confirmed first, then Skipped. 
    // Within each group, preserve the original chronological sort (slotIndex/time).
    return [...filtered].sort((a, b) => {
      if (a.status === 'Confirmed' && b.status === 'Skipped') return -1;
      if (a.status === 'Skipped' && b.status === 'Confirmed') return 1;
      return 0; // Maintain stable order from data.appointments
    });
  }, [data]);

  if (arrivedQueue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-4 text-center">
        <p className="text-sm">No patients in queue</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {arrivedQueue.map((appt) => {
        const isSelected = appt.id === selectedId;
        return (
          <button
            key={appt.id}
            onClick={() => onSelect(appt)}
            className={cn(
              "w-full text-left p-5 rounded-[2rem] border transition-all duration-500 relative overflow-hidden group",
              isSelected 
                ? "bg-slate-900 text-white border-slate-900 shadow-xl scale-[1.02] z-10" 
                : "bg-white/50 backdrop-blur-sm hover:bg-white border-white/50 hover:border-white shadow-sm hover:shadow-md"
            )}
          >
            {/* Background Accent for Selected State */}
            {isSelected && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            )}

            <div className="flex items-center gap-4 relative z-10">
              <div className={cn(
                "h-14 w-14 rounded-2xl flex flex-col items-center justify-center transition-all duration-300",
                isSelected ? "bg-white/10 text-white" : "bg-primary/10 text-primary"
              )}>
                <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">Token</span>
                <span className="text-xl font-black leading-none">{appt.tokenNumber}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "font-black text-lg truncate tracking-tight",
                    isSelected ? "text-white" : "text-slate-900"
                  )}>
                    {appt.patientName}
                  </p>
                  {appt.isPriority && (
                    <Star className={cn("h-4 w-4 fill-current", isSelected ? "text-amber-400" : "text-amber-500")} />
                  )}
                </div>
                
                <div className="flex items-center gap-3 mt-1.5">
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                    isSelected ? "bg-white/10 text-blue-200" : "bg-slate-100 text-slate-500"
                  )}>
                    <Clock className="h-3 w-3" />
                    {appt.time}
                  </div>
                  
                  {appt.status === 'Skipped' && (
                    <div className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse",
                      isSelected ? "bg-red-500/20 text-red-200" : "bg-red-50 text-red-600"
                    )}>
                      LATE / SKIPPED
                    </div>
                  )}
                  
                  {!isSelected && appt.status !== 'Skipped' && (
                    <div className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-green-50 text-green-600">
                      WAITING
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
