'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays, isSameDay } from 'date-fns';
import {
  Loader2, ArrowLeft, Coffee, CalendarDays, Clock,
  CheckCircle2, AlertTriangle, ArrowRight, Users, Timer
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api-client';
import { Suspense } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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

type Stage = 'SELECT' | 'PREVIEW' | 'DONE';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────
function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CONTENT
// ─────────────────────────────────────────────────────────────────────────────
function Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const doctorId = searchParams.get('doctor') || (typeof window !== 'undefined' ? localStorage.getItem('selectedDoctorId') : null);
  const clinicId = user?.clinicId;

  // ── Stage Machine ──
  const [stage, setStage] = useState<Stage>('SELECT');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [startSlotId, setStartSlotId] = useState<string | null>(null);
  const [endSlotId, setEndSlotId]   = useState<string | null>(null);

  // ── Dry Run state ──
  const [previewResult, setPreviewResult]   = useState<DryRunResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isConfirming, setIsConfirming]     = useState(false);
  const [compensationMode, setCompensationMode] = useState<'GAP_ABSORPTION' | 'FULL_COMPENSATION'>('GAP_ABSORPTION');

  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);

  // ── Load slots ──
  useEffect(() => {
    const fetchSlots = async () => {
      if (!doctorId || !clinicId || !selectedDate) return;
      setLoadingSlots(true);
      setStartSlotId(null);
      setEndSlotId(null);
      setStage('SELECT');
      setPreviewResult(null);
      try {
        const dateStr = format(selectedDate, 'd MMMM yyyy');
        const data = await apiRequest<any[]>(
          `/appointments/available-slots?doctorId=${doctorId}&clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}`
        );
        setSlots(data);
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load schedule.' });
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [doctorId, clinicId, selectedDate, toast]);

  // ── Slot selection ──
  const handleSlotClick = (id: string) => {
    if (!startSlotId || (startSlotId && endSlotId)) {
      setStartSlotId(id);
      setEndSlotId(null);
    } else {
      const startIdx   = slots.findIndex(s => s.time === startSlotId);
      const currentIdx = slots.findIndex(s => s.time === id);
      if (currentIdx < startIdx) { setStartSlotId(id); setEndSlotId(null); }
      else setEndSlotId(id);
    }
  };

  const selectedRange = useMemo(() => {
    if (!startSlotId) return [];
    if (!endSlotId)   return [startSlotId];
    const startIdx = slots.findIndex(s => s.time === startSlotId);
    const endIdx   = slots.findIndex(s => s.time === endSlotId);
    return slots.slice(startIdx, endIdx + 1).map(s => s.time);
  }, [startSlotId, endSlotId, slots]);

  // ── Build payload ──
  const buildPayload = useCallback((dry: boolean) => {
    const startSlot = slots.find(s => s.time === startSlotId);
    const endSlot   = slots.find(s => s.time === endSlotId);
    return {
      doctorId,
      clinicId,
      date:         format(selectedDate, 'd MMMM yyyy'),
      startTime:    format(new Date(startSlot.time), 'HH:mm'),
      endTime:      format(new Date(endSlot.time), 'HH:mm'),
      sessionIndex: startSlot.sessionIndex,
      isDryRun:     dry,
      compensationMode
    };
  }, [slots, startSlotId, endSlotId, selectedDate, doctorId, clinicId, compensationMode]);

  // ── STEP 1: Dry Run — show preview ──
  const handlePreview = async () => {
    if (!startSlotId || !endSlotId) return;
    setIsLoadingPreview(true);
    try {
      const result = await apiRequest<DryRunResult>('/breaks/schedule', {
        method: 'POST',
        body: JSON.stringify(buildPayload(true)),
      });
      setPreviewResult(result);
      setStage('PREVIEW');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Preview Failed', description: err.message });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // ── STEP 2: Commit — write to DB ──
  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await apiRequest('/breaks/schedule', {
        method: 'POST',
        body: JSON.stringify(buildPayload(false)),
      });
      setStage('DONE');
      toast({ title: '✅ Break Scheduled', description: 'Appointments have been shifted.' });
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to Schedule', description: err.message });
    } finally {
      setIsConfirming(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GUARD
  // ─────────────────────────────────────────────────────────────────────────
  if (!doctorId) return (
    <AppFrameLayout>
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
        <Coffee className="h-16 w-16 text-slate-200" />
        <h2 className="text-xl font-bold text-slate-700">No Doctor Selected</h2>
        <Button onClick={() => router.push('/')}>Go Back</Button>
      </div>
    </AppFrameLayout>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AppFrameLayout>
      <div className="flex flex-col h-full bg-slate-50">

        {/* ── HEADER ── */}
        <header className="flex items-center gap-4 p-4 bg-amber-500 text-white rounded-b-3xl shadow-lg sticky top-0 z-10">
          <Button
            onClick={() => stage === 'PREVIEW' ? setStage('SELECT') : router.back()}
            variant="ghost" size="icon"
            className="hover:bg-white/10 text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">
              {stage === 'SELECT'  && 'Schedule Break'}
              {stage === 'PREVIEW' && 'Review Impact'}
              {stage === 'DONE'    && 'Break Confirmed'}
            </h1>
            <p className="text-[10px] font-medium text-amber-100 uppercase tracking-wider">
              {stage === 'SELECT'  && 'Select your break window'}
              {stage === 'PREVIEW' && 'Confirm before committing'}
              {stage === 'DONE'    && 'Redirecting to dashboard...'}
            </p>
          </div>
          <div className="bg-white/20 p-2 rounded-xl">
            {stage === 'PREVIEW' ? <AlertTriangle className="h-5 w-5" /> : <Coffee className="h-5 w-5" />}
          </div>
        </header>

        {/* ════════════════ STAGE: SELECT ════════════════ */}
        {stage === 'SELECT' && (
          <>
            {/* Date picker */}
            <div className="p-4 bg-white border-b mb-4 mx-4 mt-4 rounded-3xl shadow-sm">
              <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-amber-500" />
                  {format(selectedDate, 'MMMM yyyy')}
                </h2>
              </div>
              <div className="flex gap-2 pb-2 px-1">
                {dates.map((date, idx) => {
                  const isSelected = isSameDay(date, selectedDate);
                  const isToday    = isSameDay(date, new Date());
                  return (
                    <button key={idx} onClick={() => setSelectedDate(date)}
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

            {/* Slot grid */}
            <main className="flex-1 p-4 pt-0 overflow-y-auto">
              {loadingSlots ? (
                <div className="flex flex-col items-center justify-center h-48 py-10">
                  <Loader2 className="h-10 w-10 animate-spin text-amber-500 mb-4" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading slots...</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 bg-white rounded-3xl border-2 border-dashed border-slate-100 mx-4">
                  <Clock className="h-12 w-12 text-slate-200 mb-4" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No slots available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pb-40">
                  {slots.map((slot, idx) => {
                    const isSelected = selectedRange.includes(slot.time);
                    const isStart    = startSlotId === slot.time;
                    const isEnd      = endSlotId   === slot.time;
                    const slotTime   = new Date(slot.time);
                    return (
                      <button key={idx} onClick={() => handleSlotClick(slot.time)}
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
                        <p className={cn("text-[10px] font-bold uppercase tracking-wider mt-1", isSelected ? "text-amber-100" : "text-slate-400")}>
                          {isStart ? 'Start' : isEnd ? 'End' : 'Select'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </main>

            {/* Bottom CTA */}
            {startSlotId && endSlotId && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t z-50 animate-in slide-in-from-bottom-full duration-300">
                <div className="max-w-md mx-auto space-y-4">
                  {/* Compensation Toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex-1 pr-4">
                      <Label htmlFor="comp-mode" className="text-sm font-black text-slate-800 uppercase tracking-tight block mb-0.5">
                        Compensate Break?
                      </Label>
                      <p className="text-[10px] text-slate-400 font-bold leading-tight">
                        {compensationMode === 'FULL_COMPENSATION' 
                          ? 'YES: Doctor gets full 30m rest; clinic stays late.' 
                          : 'NO: Swallows gaps; keeps clinic on time.'}
                      </p>
                    </div>
                    <Switch 
                      id="comp-mode"
                      checked={compensationMode === 'FULL_COMPENSATION'}
                      onCheckedChange={(checked) => setCompensationMode(checked ? 'FULL_COMPENSATION' : 'GAP_ABSORPTION')}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
                    <span>Break Window</span>
                    <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                      {format(new Date(slots.find(s => s.time === startSlotId)!.time), 'hh:mm a')}
                      {' – '}
                      {format(new Date(slots.find(s => s.time === endSlotId)!.time),   'hh:mm a')}
                    </span>
                  </div>
                  <Button
                    id="preview-break-btn"
                    onClick={handlePreview}
                    disabled={isLoadingPreview}
                    className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-lg shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    {isLoadingPreview
                      ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Calculating Impact...</>
                      : <><span>Preview Impact</span><ArrowRight className="h-5 w-5" /></>
                    }
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════ STAGE: PREVIEW ════════════════ */}
        {stage === 'PREVIEW' && previewResult && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-36">

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-4 border-2 border-slate-100 text-center shadow-sm">
                <Users className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-slate-800">{previewResult.shiftedCount}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Shifted</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border-2 border-slate-100 text-center shadow-sm">
                <Timer className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-slate-800">{previewResult.delayMinutes}m</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Day Delay</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border-2 border-slate-100 text-center shadow-sm">
                <Coffee className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-2xl font-black text-slate-800">{previewResult.ghostsCreated}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Blocked</p>
              </div>
            </div>

            {/* What Happens Next detail list */}
            <div className="bg-white rounded-3xl border-2 border-slate-100 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">What Happens Next</h3>
                {previewResult.preview.length === 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">No patients delayed by more than 15 min — clean break!</p>
                )}
              </div>
              {previewResult.preview.length > 0 && (
                <div className="divide-y divide-slate-50">
                  {previewResult.preview.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center">
                          <span className="text-[9px] font-black text-amber-600">{entry.tokenNumber}</span>
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-700">{formatTime(entry.oldTime)} → {formatTime(entry.newTime)}</p>
                          <p className="text-[9px] text-slate-400 font-bold">+{entry.deltaMinutes} min delay</p>
                        </div>
                      </div>
                      <div className={cn(
                        "text-[9px] font-black px-2 py-1 rounded-lg uppercase",
                        entry.deltaMinutes >= 30 ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"
                      )}>
                        {entry.deltaMinutes >= 30 ? 'High' : 'Medium'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warning note */}
            {previewResult.delayMinutes === 0 && (
              <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-700 font-semibold">
                  This break falls in an empty window. <strong>Zero patient delay.</strong> Only the slots will be blocked.
                </p>
              </div>
            )}
          </div>
        )}

        {/* PREVIEW bottom CTA */}
        {stage === 'PREVIEW' && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t z-50">
            <div className="max-w-md mx-auto flex gap-3">
              <Button
                onClick={() => setStage('SELECT')}
                variant="outline"
                className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-widest border-2"
              >
                Go Back
              </Button>
              <Button
                id="confirm-break-btn"
                onClick={handleConfirm}
                disabled={isConfirming}
                className="flex-[2] h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-base shadow-lg shadow-amber-500/20 active:scale-[0.98]"
              >
                {isConfirming
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : 'Confirm & Schedule Break'
                }
              </Button>
            </div>
          </div>
        )}

        {/* ════════════════ STAGE: DONE ════════════════ */}
        {stage === 'DONE' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-black text-slate-800">Break Scheduled!</h2>
              <p className="text-sm text-slate-500 mt-2">Redirecting to dashboard...</p>
            </div>
          </div>
        )}

      </div>
    </AppFrameLayout>
  );
}

export default function ScheduleBreakPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-amber-50">
        <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
        <p className="text-amber-600 font-medium">Accessing Schedule...</p>
      </div>
    }>
      <Content />
    </Suspense>
  );
}
