'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Clock, Calendar, AlertTriangle, Coffee, Loader2, ChevronRight, 
  Check, Trash2, ArrowRight, Users, Timer, X, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doctor, BreakPeriod, Role } from '@kloqo/shared';
import { format, isSameDay, addDays, addMinutes } from "date-fns";
import { Calendar as CalendarComp } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/api-client";
import { getClinicTimeString, getClinic12hTimeString, parseClinicDate, parseClinicTime } from '@kloqo/shared-core';
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface PreviewEntry {
  tokenNumber: string;
  oldTime: string;
  newTime: string;
  deltaMinutes: number;
}

interface DryRunResult {
  committed: boolean;
  breakPeriod: any;
  shiftedCount: number;
  ghostsCreated: number;
  delayMinutes: number;
  preview: PreviewEntry[];
}

interface BreakTabProps {
  doctor: Doctor;
  leaveDate: Date;
  onDateChange: (date: Date) => void;
  onUpdate: (field: keyof Doctor, value: any) => Promise<void>;
  isPending: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function BreakTab({ doctor, leaveDate, onDateChange, onUpdate, isPending }: BreakTabProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  // Stage management for Add Break flow
  const [stage, setStage] = useState<'SELECT' | 'PREVIEW'>('SELECT');
  const [previewResult, setPreviewResult] = useState<DryRunResult | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  const dateKey = format(leaveDate, "yyyy-MM-dd");
  const dateStrForDisplay = format(leaveDate, "d MMMM yyyy");
  
  const breakPeriodsRecord = (doctor.breakPeriods && !Array.isArray(doctor.breakPeriods)) 
    ? doctor.breakPeriods as Record<string, BreakPeriod[]> 
    : {};
    
  const breaksForToday = breakPeriodsRecord[dateKey] || [];
  
  // ── Calculate Dropdowns ──
  const [sessionIndex, setSessionIndex] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);

  const availableSessions = useMemo(() => {
    if (!doctor || !doctor.availabilitySlots) return [];
    const dayOfWeek = format(leaveDate, 'EEEE');
    const dayAvailability = doctor.availabilitySlots.find((s: any) => s.day === dayOfWeek);
    return dayAvailability ? dayAvailability.timeSlots : [];
  }, [doctor, leaveDate]);

  const timeIntervals = useMemo(() => {
    if (sessionIndex === null || !availableSessions[sessionIndex]) return [];
    const session = availableSessions[sessionIndex];
    const intervals: string[] = [];
    
    // Strict IST Compliance
    const baseDate = parseClinicDate(dateStrForDisplay);
    let current = parseClinicTime(session.from, baseDate);
    const end = parseClinicTime(session.to, baseDate);
    const step = doctor?.averageConsultingTime || 15;
    
    while (current <= end) {
      intervals.push(getClinicTimeString(current));
      current = addMinutes(current, step);
    }
    return intervals;
  }, [sessionIndex, availableSessions, dateStrForDisplay, doctor]);

  const endIntervals = useMemo(() => {
    if (!startTime) return timeIntervals;
    const startIndex = timeIntervals.indexOf(startTime);
    return startIndex >= 0 ? timeIntervals.slice(startIndex + 1) : [];
  }, [startTime, timeIntervals]);

  useEffect(() => {
    setSessionIndex(null);
    setStartTime(null);
    setEndTime(null);
    setStage('SELECT');
    setPreviewResult(null);
  }, [leaveDate, isSheetOpen]);

  // ── Actions ──
  const handlePreview = async () => {
    if (sessionIndex === null || !startTime || !endTime) return;
    setIsScheduling(true);
    try {
      const res = await apiRequest<DryRunResult>('/breaks/schedule', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: doctor.id,
          clinicId: doctor.clinicId,
          date: dateStrForDisplay,
          startTime,
          endTime,
          sessionIndex,
          isDryRun: true
        })
      });
      setPreviewResult(res);
      setStage('PREVIEW');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Preview Failed', description: err.message });
    } finally {
      setIsScheduling(false);
    }
  };

  const handleConfirmSchedule = async () => {
    if (sessionIndex === null || !startTime || !endTime) return;
    setIsScheduling(true);
    try {
      await apiRequest('/breaks/schedule', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: doctor.id,
          clinicId: doctor.clinicId,
          date: dateStrForDisplay,
          startTime,
          endTime,
          sessionIndex,
          isDryRun: false
        })
      });
      toast({ title: 'Success', description: 'Break scheduled and appointments shifted.' });
      setIsSheetOpen(false);
      if (onUpdate) await onUpdate('id' as any, doctor.id); 
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsScheduling(false);
    }
  };

  const handleDeleteBreak = async (breakId: string) => {
    setIsDeleting(breakId);
    try {
      await apiRequest('/breaks/cancel', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: doctor.id,
          clinicId: doctor.clinicId,
          date: dateStrForDisplay,
          breakId,
          shouldOpenSlots: true,
          shouldPullForward: false
        })
      });
      toast({ title: 'Success', description: 'Break cancelled and slots opened.' });
      if (onUpdate) await onUpdate('id' as any, doctor.id);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsDeleting(null);
    }
  };

  // ── Render Helpers ──
  const formatTimeStr = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── LEFT: CALENDAR ── */}
      <div className="lg:col-span-4 space-y-6">
        <Card className="border-none shadow-2xl shadow-black/5 rounded-[2.5rem] bg-white overflow-hidden p-8">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-6 px-2">Clinical Calendar</label>
           <CalendarComp
             mode="single"
             selected={leaveDate}
             onSelect={d => d && onDateChange(d)}
             className="w-full scale-105"
           />
        </Card>
      </div>

      {/* ── RIGHT: BREAK LIST ── */}
      <div className="lg:col-span-8 space-y-8">
        <Card className="border-none shadow-2xl shadow-black/5 rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-row items-center justify-between space-y-0 text-left">
             <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Coffee className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Break Management</CardTitle>
                <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Schedule clinical pauses and sessions </CardDescription>
              </div>
            </div>
            
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button className="rounded-xl bg-slate-900 hover:bg-slate-800 font-black uppercase text-[10px] tracking-widest text-white px-8 h-12 transition-all">
                  Add New Break
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-xl p-0 bg-slate-50 border-none overflow-y-auto">
                <SheetHeader className="p-8 bg-white border-b sticky top-0 z-10 text-left">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                    <Coffee className="h-6 w-6 text-amber-500" />
                  </div>
                  <SheetTitle className="text-2xl font-black text-slate-800 uppercase tracking-tight">Schedule clinical break</SheetTitle>
                  <SheetDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {stage === 'SELECT' ? 'Step 1: Select slot range' : 'Step 2: Review clinical impact'}
                  </SheetDescription>
                </SheetHeader>

                <div className="p-8 space-y-6">
                  {stage === 'SELECT' ? (
                    <>
                      {availableSessions.length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center text-slate-400 text-center">
                          <Calendar className="h-12 w-12 mb-4 opacity-10" />
                          <p className="text-[10px] font-black uppercase tracking-widest">No available sessions for this date</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
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
                              {availableSessions.map((session: any, idx: number) => (
                                <option key={idx} value={idx}>
                                  Session {idx + 1}: {formatTimeStr(session.from)} - {formatTimeStr(session.to)}
                                </option>
                              ))}
                            </select>
                          </div>

                          {sessionIndex !== null && (
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
                          )}

                          {sessionIndex !== null && startTime && endTime && (
                            <div className="space-y-4 pt-4 animate-in slide-in-from-bottom-2">
                              <Button 
                                onClick={handlePreview} 
                                disabled={isScheduling}
                                className="w-full bg-amber-900 text-white hover:bg-amber-800 rounded-2xl h-14 font-black uppercase text-xs tracking-widest transition-all shadow-lg"
                              >
                                {isScheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span className="mr-2">Preview Impact</span> <ArrowRight className="h-4 w-4" /></>}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : previewResult && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                      {/* Summary Metrics */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
                          <Users className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                          <p className="text-2xl font-black text-slate-800 leading-none mb-1">{previewResult.shiftedCount}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Shifted</p>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
                          <Timer className="h-5 w-5 text-blue-500 mx-auto mb-2" />
                          <p className="text-2xl font-black text-slate-800 leading-none mb-1">{previewResult.delayMinutes}m</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Day Delay</p>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
                          <Coffee className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
                          <p className="text-2xl font-black text-slate-800 leading-none mb-1">{previewResult.ghostsCreated}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Blocked</p>
                        </div>
                      </div>

                      {/* Detail List */}
                      <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                        <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/50">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Queue Recalculation</h4>
                          <p className="text-xs font-bold text-slate-400">Total of {previewResult.preview.length} patients delayed by &gt; 15m</p>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {previewResult.preview.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                              {previewResult.preview.map((p, i) => (
                                <div key={i} className="px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-all">
                                  <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 text-[10px] font-black">
                                      {p.tokenNumber}
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-slate-800">{formatTimeStr(p.oldTime)} → {formatTimeStr(p.newTime)}</p>
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">+{p.deltaMinutes} min shift</p>
                                    </div>
                                  </div>
                                  <div className={cn("px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest", p.deltaMinutes > 30 ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500")}>
                                     {p.deltaMinutes > 30 ? 'Critical' : 'Standard'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-12 text-center text-slate-300">
                              <Check className="h-12 w-12 mx-auto mb-4 opacity-10" />
                              <p className="text-[10px] font-black uppercase tracking-widest">No major patient delays detected</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 sticky bottom-0 bg-slate-50 pt-4">
                        <Button
                          id="confirm-schedule-break-btn" 
                          onClick={handleConfirmSchedule}
                          disabled={isScheduling}
                          className="w-full bg-slate-900 hover:bg-black text-white rounded-2xl h-16 font-black uppercase text-sm tracking-[0.1em] shadow-xl shadow-black/10 transition-all"
                        >
                          {isScheduling ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirm Clinical Break'}
                        </Button>
                        <Button 
                          variant="ghost" 
                          onClick={() => setStage('SELECT')}
                          className="w-full rounded-2xl h-12 font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-600"
                        >
                          Back to Selection
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </CardHeader>
          <CardContent className="p-8">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
              Scheduled for {format(leaveDate, "EEE, MMM d")}
              <div className="h-0.5 bg-slate-100 flex-1" />
            </h3>

            {breaksForToday.length > 0 ? (
              <div className="space-y-4">
                {breaksForToday.map(b => (
                  <div key={b.id} className="p-6 rounded-[2rem] bg-slate-50 border-2 border-slate-100/50 flex items-center justify-between group hover:bg-white hover:border-theme-blue/10 transition-all">
                    <div className="flex items-center gap-6">
                       <div className="h-14 w-14 rounded-2xl bg-white shadow-xl shadow-black/5 flex items-center justify-center border-2 border-slate-50">
                         <div className="p-2.5 rounded-xl bg-amber-500/10">
                           <Coffee className="h-6 w-6 text-amber-500" />
                         </div>
                       </div>
                       <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Time Slot</p>
                         <p className="text-lg font-black text-slate-800 tracking-tight">{formatTimeStr(b.startTimeFormatted)} – {formatTimeStr(b.endTimeFormatted)}</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {isDeleting === b.id ? (
                           <Loader2 className="h-5 w-5 animate-spin text-red-500" />
                        ) : (
                          <Button 
                            variant="ghost" 
                            onClick={() => handleDeleteBreak(b.id)} 
                            className="h-12 w-12 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all p-0"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-24 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100">
                <Coffee className="h-12 w-12 mb-4 text-slate-100 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">No breaks scheduled for this date</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── INFO BOX ── */}
        <div className="p-10 rounded-[3rem] bg-amber-50/50 border-2 border-amber-100/50 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
           <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-amber-200/10 rounded-full blur-3xl" />
           <div className="h-20 w-20 rounded-3xl bg-amber-500/10 flex items-center justify-center border-2 border-amber-500/20 shrink-0">
             <AlertTriangle className="h-10 w-10 text-amber-600" />
           </div>
           <div className="space-y-2 text-left">
             <h4 className="text-lg font-black text-amber-900 uppercase tracking-tight leading-none">Smart Break Scheduling</h4>
             <p className="text-sm font-bold text-amber-700/70 leading-relaxed max-w-xl">
               Scheduled breaks will automatically shift existing appointments. Ensure sufficient margin is maintained for critical consultations. Session extensions are calculated based on the break duration.
             </p>
           </div>
           <Button variant="ghost" className="md:ml-auto h-14 w-14 rounded-2xl bg-amber-500/20 text-amber-900 hover:bg-amber-500 hover:text-white transition-all px-0">
              <ChevronRight className="h-6 w-6" />
           </Button>
        </div>
      </div>
    </div>
  );
}
