import React from 'react';
import { Clock, CalendarDays, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Doctor } from '@kloqo/shared';

interface BreakTimeSelectorProps {
  doctor: Doctor | null;
  availableSessions: any[];
  timeIntervals: string[];
  endIntervals: string[];
  sessionIndex: number | null;
  setSessionIndex: (val: number | null) => void;
  startTime: string | null;
  setStartTime: (val: string | null) => void;
  endTime: string | null;
  setEndTime: (val: string | null) => void;
  isFullCompensation: boolean;
  setIsFullCompensation: (val: boolean) => void;
}

const formatTimeStr = (t: string) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const BreakSlotGrid: React.FC<BreakTimeSelectorProps> = ({
  doctor,
  availableSessions,
  timeIntervals,
  endIntervals,
  sessionIndex,
  setSessionIndex,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  isFullCompensation,
  setIsFullCompensation
}) => {
  if (!doctor) {
    return (
      <div className="flex flex-col items-center justify-center h-48 py-10">
        <Loader2 className="h-10 w-10 animate-spin text-amber-500 mb-4" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Doctor Data...</p>
      </div>
    );
  }

  if (availableSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-white rounded-3xl border-2 border-dashed border-slate-100 mx-4">
        <CalendarDays className="h-12 w-12 text-slate-200 mb-4" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center px-6">
          No availability for this date
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 pb-40">
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Select Session</label>
        <select 
          className="w-full h-14 bg-white border-2 border-slate-100 rounded-2xl px-4 text-sm font-black text-slate-800 outline-none focus:border-amber-500 transition-all"
          value={sessionIndex === null ? '' : sessionIndex}
          onChange={(e) => {
            setSessionIndex(e.target.value === '' ? null : Number(e.target.value));
            setStartTime(null);
            setEndTime(null);
          }}
        >
          <option value="" disabled>Choose a session...</option>
          {availableSessions.map((session, idx) => (
            <option key={idx} value={idx}>
              Session {idx + 1}: {formatTimeStr(session.from)} - {formatTimeStr(session.to)}
            </option>
          ))}
        </select>
      </div>

      {sessionIndex !== null && (
        <>
          <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Start Time</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                <select 
                  className={cn(
                    "w-full h-14 bg-white border-2 rounded-2xl pl-12 pr-4 text-sm font-black text-slate-800 outline-none transition-all",
                    startTime ? "border-amber-500 shadow-sm shadow-amber-500/10" : "border-slate-100 focus:border-amber-500"
                  )}
                  value={startTime || ''}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setEndTime(null);
                  }}
                >
                  <option value="" disabled>Start...</option>
                  {timeIntervals.slice(0, -1).map((time) => (
                    <option key={time} value={time}>{formatTimeStr(time)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">3. End Time</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                <select 
                  disabled={!startTime}
                  className={cn(
                    "w-full h-14 bg-white border-2 rounded-2xl pl-12 pr-4 text-sm font-black text-slate-800 outline-none transition-all",
                    !startTime ? "opacity-50 cursor-not-allowed bg-slate-50" :
                    endTime ? "border-amber-500 shadow-sm shadow-amber-500/10" : "border-slate-100 focus:border-amber-500"
                  )}
                  value={endTime || ''}
                  onChange={(e) => setEndTime(e.target.value)}
                >
                  <option value="" disabled>End...</option>
                  {endIntervals.map((time) => (
                    <option key={time} value={time}>{formatTimeStr(time)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 🛡️ COMPENSATION STRATEGY TOGGLE 🛡️ */}
          <div 
            onClick={() => setIsFullCompensation(!isFullCompensation)}
            className={cn(
              "p-5 rounded-3xl border-2 transition-all cursor-pointer group flex items-start gap-4",
              isFullCompensation 
                ? "bg-amber-500 border-amber-600 shadow-lg shadow-amber-500/20" 
                : "bg-white border-slate-100 hover:border-slate-200"
            )}
          >
            <div className={cn(
              "h-6 w-11 rounded-full relative transition-all flex items-center px-1 shrink-0",
              isFullCompensation ? "bg-white/30" : "bg-slate-200"
            )}>
              <div className={cn(
                "h-4 w-4 rounded-full bg-white shadow-md transition-all transform",
                isFullCompensation ? "translate-x-5" : "translate-x-0"
              )} />
            </div>
            <div className="space-y-1">
              <p className={cn(
                "text-xs font-black tracking-tight",
                isFullCompensation ? "text-white" : "text-slate-800"
              )}>
                Full Break Compensation
              </p>
              <p className={cn(
                "text-[10px] font-medium leading-relaxed",
                isFullCompensation ? "text-amber-50/80" : "text-slate-400"
              )}>
                Extends your availability by the full break time to allow new bookings at the end of the day.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
