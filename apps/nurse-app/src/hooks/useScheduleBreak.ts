import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays, addMinutes } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { getClinicTimeString, parseClinicDate, parseClinicTime } from '@kloqo/shared-core';
import type { Doctor } from '@kloqo/shared';

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

  const [stage, setStage] = useState<Stage>('SELECT');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [doctor, setDoctor] = useState<Doctor | null>(doctorProp || null);

  const [sessionIndex, setSessionIndex] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  
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

  // Reset selections when date changes
  useEffect(() => {
    setSessionIndex(null);
    setStartTime(null);
    setEndTime(null);
    setStage('SELECT');
    setPreviewResult(null);
  }, [selectedDate]);

  const availableSessions = useMemo(() => {
    if (!doctor || !doctor.availabilitySlots) return [];
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
      date:         format(selectedDate, 'd MMMM yyyy'),
      startTime,
      endTime,
      sessionIndex,
      isDryRun:     dry
    };
  }, [sessionIndex, startTime, endTime, selectedDate, doctorId, clinicId]);

  const handlePreview = async () => {
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
  };

  const handleConfirm = async () => {
    const payload = buildPayload(false);
    if (!payload) return;
    setIsConfirming(true);
    try {
      await apiRequest('/breaks/schedule', {
        method: 'POST',
        body: JSON.stringify(payload),
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

  return {
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
    previewResult,
    isLoadingPreview,
    isConfirming,
    dates,
    handlePreview,
    handleConfirm
  };
}
