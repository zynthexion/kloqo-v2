import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { getClinicTimeString } from '@kloqo/shared-core';

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

export function useScheduleBreak() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const doctorId = searchParams.get('doctor') || (typeof window !== 'undefined' ? localStorage.getItem('selectedDoctorId') : null);
  const clinicId = user?.clinicId;

  const [stage, setStage] = useState<Stage>('SELECT');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [startSlotId, setStartSlotId] = useState<string | null>(null);
  const [endSlotId, setEndSlotId]   = useState<string | null>(null);

  const [previewResult, setPreviewResult]   = useState<DryRunResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isConfirming, setIsConfirming]     = useState(false);
  const [compensationMode, setCompensationMode] = useState<'GAP_ABSORPTION' | 'FULL_COMPENSATION'>('GAP_ABSORPTION');

  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);

  const fetchSlots = useCallback(async () => {
    if (!doctorId || !clinicId || !selectedDate) return;
    setLoadingSlots(true);
    setStartSlotId(null);
    setEndSlotId(null);
    setStage('SELECT');
    setPreviewResult(null);
    try {
      const dateStr = format(selectedDate, 'd MMMM yyyy');
      const response = await apiRequest<any>(
        `/appointments/available-slots?doctorId=${doctorId}&clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}`
      );
      setSlots(response.slots || []);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load schedule.' });
    } finally {
      setLoadingSlots(false);
    }
  }, [doctorId, clinicId, selectedDate, toast]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleSlotClick = useCallback((id: string) => {
    if (!startSlotId || (startSlotId && endSlotId)) {
      setStartSlotId(id);
      setEndSlotId(null);
    } else {
      const startIdx   = slots.findIndex(s => s.time === startSlotId);
      const currentIdx = slots.findIndex(s => s.time === id);
      if (currentIdx < startIdx) {
        setStartSlotId(id);
        setEndSlotId(null);
      } else {
        setEndSlotId(id);
      }
    }
  }, [startSlotId, endSlotId, slots]);

  const selectedRange = useMemo(() => {
    if (!startSlotId) return [];
    if (!endSlotId)   return [startSlotId];
    const startIdx = slots.findIndex(s => s.time === startSlotId);
    const endIdx   = slots.findIndex(s => s.time === endSlotId);
    return slots.slice(startIdx, endIdx + 1).map(s => s.time);
  }, [startSlotId, endSlotId, slots]);

  const buildPayload = useCallback((dry: boolean) => {
    const startSlot = slots.find(s => s.time === startSlotId);
    const endSlot   = slots.find(s => s.time === endSlotId);
    if (!startSlot || !endSlot) return null;

    return {
      doctorId,
      clinicId,
      date:         format(selectedDate, 'd MMMM yyyy'),
      startTime:    getClinicTimeString(new Date(startSlot.time)),
      endTime:      getClinicTimeString(new Date(endSlot.time)),
      sessionIndex: startSlot.sessionIndex,
      isDryRun:     dry,
      compensationMode
    };
  }, [slots, startSlotId, endSlotId, selectedDate, doctorId, clinicId, compensationMode]);

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
    slots,
    loadingSlots,
    startSlotId,
    endSlotId,
    selectedRange,
    previewResult,
    isLoadingPreview,
    isConfirming,
    compensationMode,
    setCompensationMode,
    dates,
    handleSlotClick,
    handlePreview,
    handleConfirm
  };
}
