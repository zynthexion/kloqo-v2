import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays, addMinutes } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { getClinicTimeString, parseClinicDate, parseClinicTime, getClinicISODateString, getClinicNow } from '@kloqo/shared-core';
import type { Doctor, BreakPeriod } from '@kloqo/shared';

export type Stage = 'SELECT' | 'PREVIEW' | 'DONE';

export interface PreviewEntry {
  tokenNumber: string;
  oldTime: string;
  newTime: string;
  deltaMinutes: number;
}

export interface DryRunResult {
  committed: boolean;
  breakPeriod: any;
  shiftedCount: number;
  ghostsCreated: number;
  delayMinutes: number;
  preview: PreviewEntry[];
}

export function useScheduleBreak(doctorProp?: Doctor | null) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const doctorId = searchParams.get('doctor') || (typeof window !== 'undefined' ? localStorage.getItem('selectedDoctorId') : null);
  const clinicId = user?.clinicId;

  const editId = searchParams.get('editId');

  const [stage, setStage] = useState<Stage>('SELECT');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const urlDate = searchParams.get('date');
    if (urlDate) {
      const parsed = parseClinicDate(urlDate);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return getClinicNow();
  });
  const [doctor, setDoctor] = useState<Doctor | null>(doctorProp || null);

  const [sessionIndex, setSessionIndex] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  
  const [isFullCompensation, setIsFullCompensation] = useState(false);
  const [previewResult, setPreviewResult] = useState<DryRunResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);

  const fetchDoctor = useCallback(async () => {
    if (doctorProp) {
        setDoctor(doctorProp);
        return;
    }
    if (!doctorId) return;
    try {
      const response = await apiRequest<{ doctor: Doctor }>(`/doctors/${doctorId}`);
      setDoctor(response.doctor);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load doctor data.' });
    }
  }, [doctorId, doctorProp, toast]);

  useEffect(() => {
    fetchDoctor();
  }, [fetchDoctor]);

  // Pre-fill Edit Mode
  useEffect(() => {
    if (editId && doctor) {
      const dateKey = format(selectedDate, 'd MMMM yyyy');
      const isoDateKey = format(selectedDate, 'yyyy-MM-dd');
      const dayBreaks = (doctor.breakPeriods?.[dateKey] || doctor.breakPeriods?.[isoDateKey] || []) as BreakPeriod[];
      const b = dayBreaks.find(x => x.id === editId);
      if (b) {
        setSessionIndex(b.sessionIndex);
        setStartTime(b.startTimeFormatted || b.startTime);
        setEndTime(b.endTimeFormatted || b.endTime);
        setIsFullCompensation((b.actualShiftMinutes ?? 0) > 0);
      }
    }
  }, [editId, doctor, selectedDate]);

  // Reset selections when date changes (if not in edit mode)
  useEffect(() => {
    if (!editId) {
      setSessionIndex(null);
      setStartTime(null);
      setEndTime(null);
      setStage('SELECT');
      setPreviewResult(null);
      setIsFullCompensation(false);
    }
  }, [selectedDate, editId]);

  const availableSessions = useMemo(() => {
    if (!doctor) return [];
    
    // 🛡️ DATE OVERRIDE PRIORITY: Check if there's a tactical override for this specific date
    const dateKey = getClinicISODateString(selectedDate);
    const override = doctor.dateOverrides?.[dateKey];

    if (override) {
      if (override.isOff) return [];
      return override.slots || [];
    }

    // Fallback: Recurring Weekly Availability
    if (!doctor.availabilitySlots) return [];
    const dayOfWeek = format(selectedDate, 'EEEE');
    const dayAvailability = doctor.availabilitySlots.find((s: any) => s.day === dayOfWeek);
    return dayAvailability ? dayAvailability.timeSlots : [];
  }, [doctor, selectedDate]);

  const timeIntervals = useMemo(() => {
    if (sessionIndex === null || !availableSessions[sessionIndex]) return [];
    const session = availableSessions[sessionIndex];
    const intervals: string[] = [];
    
    // Strict IST Compliance
    const baseDate = parseClinicDate(format(selectedDate, 'yyyy-MM-dd'));
    let current = parseClinicTime(session.from, baseDate);
    const end = parseClinicTime(session.to, baseDate);
    const step = doctor?.averageConsultingTime || 15;
    
    while (current <= end) {
      intervals.push(getClinicTimeString(current));
      current = addMinutes(current, step);
    }
    return intervals;
  }, [sessionIndex, availableSessions, selectedDate, doctor]);

  const endIntervals = useMemo(() => {
    if (!startTime) return timeIntervals;
    const startIndex = timeIntervals.indexOf(startTime);
    return startIndex >= 0 ? timeIntervals.slice(startIndex + 1) : [];
  }, [startTime, timeIntervals]);

  const buildPayload = useCallback((dry: boolean) => {
    if (sessionIndex === null || !startTime || !endTime) return null;

    return {
      doctorId,
      clinicId,
      date:             format(selectedDate, 'd MMMM yyyy'),
      startTime,
      endTime,
      sessionIndex,
      compensationMode: isFullCompensation ? 'FULL_COMPENSATION' : 'GAP_ABSORPTION',
      replaceBreakId:   editId || undefined,
      isDryRun:         dry
    };
  }, [sessionIndex, startTime, endTime, selectedDate, doctorId, clinicId, isFullCompensation, editId]);

  const handlePreview = useCallback(async () => {
    const payload = buildPayload(true);
    if (!payload) return;
    setIsLoadingPreview(true);
    try {
      const result = await apiRequest<DryRunResult>('/breaks/schedule', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPreviewResult(result);
      setStage('PREVIEW');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Preview Failed', description: err.message });
    } finally {
      setIsLoadingPreview(false);
    }
  }, [buildPayload, toast]);

  const handleConfirm = useCallback(async () => {
    const payload = buildPayload(false);
    if (!payload) return;
    setIsConfirming(true);
    try {
      await apiRequest('/breaks/schedule', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setStage('DONE');
      toast({ title: editId ? '✅ Break Updated' : '✅ Break Scheduled', description: 'Appointments have been shifted.' });
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to Schedule', description: err.message });
    } finally {
      setIsConfirming(false);
    }
  }, [buildPayload, router, toast, editId]);

  const handleCancelBreak = useCallback(async (breakId: string) => {
    if (!doctorId || !clinicId) return;
    setIsConfirming(true);
    try {
      await apiRequest('/breaks/cancel', {
        method: 'POST',
        body: JSON.stringify({
          doctorId,
          clinicId,
          date: format(selectedDate, 'd MMMM yyyy'),
          breakId,
          shouldOpenSlots: true,
          shouldPullForward: true
        }),
      });
      toast({ title: '✅ Break Cancelled', description: 'Slots have been reopened.' });
      fetchDoctor();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Cancellation Failed', description: err.message });
    } finally {
      setIsConfirming(false);
    }
  }, [doctorId, clinicId, selectedDate, toast, fetchDoctor]);

  return useMemo(() => ({
    router,
    doctorId,
    clinicId,
    stage,
    setStage,
    selectedDate,
    setSelectedDate,
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
    setIsFullCompensation,
    previewResult,
    isLoadingPreview,
    isConfirming,
    dates,
    editId,
    handlePreview,
    handleConfirm,
    handleCancelBreak
  }), [
    router, doctorId, clinicId, stage, selectedDate, doctor,
    availableSessions, timeIntervals, endIntervals, sessionIndex,
    startTime, endTime, isFullCompensation, previewResult,
    isLoadingPreview, isConfirming, dates, editId, handlePreview, handleConfirm, handleCancelBreak
  ]);
}
