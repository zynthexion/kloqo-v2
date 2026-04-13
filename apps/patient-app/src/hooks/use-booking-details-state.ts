'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, subMinutes } from 'date-fns';
import { apiRequest } from '@/lib/api-client';
import { getDoctorFromCache, saveDoctorToCache } from '@/lib/doctor-cache';
import type { Doctor } from '@kloqo/shared';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/language-context';

/**
 * useBookingDetailsState
 * Logic for fetching doctor details and verifying slot availability via REST.
 * Implements progressive loading (cache -> API).
 */
export function useBookingDetailsState() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const doctorId = searchParams.get('doctorId');
  const slotISO = searchParams.get('slot');
  const selectedSlot = slotISO ? new Date(slotISO) : null;

// fetch-initial is null to avoid hydration mismatch
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [slotAvailable, setSlotAvailable] = useState<boolean | null>(null);

  // Hydration-safe initial load from cache
  useEffect(() => {
    if (doctorId) {
      const cached = getDoctorFromCache(doctorId);
      if (cached) {
        setDoctor(cached);
        setLoading(false);
      }
    }
  }, [doctorId]);

  const fetchDoctor = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    
    try {
      // Consistent use of unified V2 backend path
      const data = await apiRequest<Doctor>(`/doctors/${doctorId}`);
      setDoctor(data);
      saveDoctorToCache(doctorId, data);
    } catch (error) {
      toast({ variant: 'destructive', title: t.bookAppointment.error });
    } finally {
      setLoading(false);
    }
  }, [doctorId, toast, t]);

  const checkSlotAvailability = useCallback(async () => {
    if (!doctor || !selectedSlot) return;
    try {
      const dateStr = format(selectedSlot, 'd MMMM yyyy');
      const timeStr = format(selectedSlot, 'hh:mm a');
      const res = await apiRequest<{ available: boolean }>(
        `/appointments/public/check-slot?clinicId=${doctor.clinicId}&doctorId=${doctor.id}&date=${dateStr}&time=${timeStr}`
      );
      setSlotAvailable(res.available);
    } catch (error) {
      console.error('Slot check failed');
    }
  }, [doctor, selectedSlot]);

  useEffect(() => { fetchDoctor(); }, [fetchDoctor]);
  useEffect(() => { if (doctor) checkSlotAvailability(); }, [doctor, checkSlotAvailability]);

  return {
    doctor, 
    selectedSlot, 
    loading, 
    slotAvailable,
    doctorId
  };
}
