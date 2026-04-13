
'use client';

import { cn } from '@/lib/utils';
import { Appointment } from '@kloqo/shared';
import { useMemo } from 'react';
import { CheckCircle2, Clock, Users } from 'lucide-react';

type DailyProgressProps = {
  appointments: Appointment[];
  className?: string;
};

export default function DailyProgress({ appointments, className }: DailyProgressProps) {
  const stats = useMemo(() => {
    const total = appointments.length;
    const completed = appointments.filter(a => a.status === 'Completed').length;
    const arrived = appointments.filter(a => ['Confirmed', 'Skipped'].includes(a.status)).length;
    const pending = appointments.filter(a => a.status === 'Pending').length;
    
    const progress = total > 0 ? (completed / total) * 100 : 0;
    
    return { total, completed, arrived, pending, progress };
  }, [appointments]);

  return (
    <div className={cn("grid grid-cols-2 gap-4 p-4", className)}>
      <div className="col-span-2 glass-card rounded-[2.5rem] p-6 flex items-center justify-between border-none shadow-premium bg-white/60">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-slate-400 mb-1">Daily Progress</p>
          <h3 className="text-3xl font-black text-foreground">
            {stats.completed} <span className="text-muted-foreground text-lg">/ {stats.total}</span>
          </h3>
          <p className="text-xs font-medium text-muted-foreground mt-1">Appointments Completed</p>
        </div>
        <div className="relative w-20 h-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-slate-100"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeDasharray={251.2}
              strokeDashoffset={251.2 - (251.2 * stats.progress) / 100}
              strokeLinecap="round"
              className="text-primary transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-black text-foreground">{Math.round(stats.progress)}%</span>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-[2.5rem] p-5 border-none shadow-premium bg-white/40">
        <div className="bg-primary w-10 h-10 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-primary/30">
          <Users className="h-5 w-5 text-white" />
        </div>
        <p className="text-2xl font-black text-foreground">{stats.arrived}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">In Waiting</p>
      </div>

      <div className="glass-card rounded-[2.5rem] p-5 border-none shadow-premium bg-white/40">
        <div className="bg-slate-400 w-10 h-10 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-slate-400/30">
          <Clock className="h-5 w-5 text-white" />
        </div>
        <p className="text-2xl font-black text-foreground">{stats.pending}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pending</p>
      </div>
    </div>
  );
}
