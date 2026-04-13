'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays, isSameDay, subMinutes } from 'date-fns';
import { apiRequest } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

import { getClinicNow } from '@kloqo/shared-core';

/**
 * useBookAppointmentState
 * Logic for fetching doctor/patient details, slot retrieval, and booking orchestration.
 */
export function useBookAppointmentState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const doctorId = searchParams.get('doctor');
  const patientId = searchParams.get('patientId');
  const clinicId = user?.clinicId;

  // Dubai Patient Trap: Initialize with IST time
  const [selectedDate, setSelectedDate] = useState<Date>(getClinicNow());
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [step, setStep] = useState<'selection' | 'summary'>('selection');
  const [patient, setPatient] = useState<any>(null);
  const [doctor, setDoctor] = useState<any>(null);
  const [fetchingDoctor, setFetchingDoctor] = useState(true);

  // 1. Resolve Available Dates
  const dates = useMemo(() => {
    // Principal SRE Catch: Total synchronization with IST baseline
    const nowIst = getClinicNow();
    const limit = doctor?.advanceBookingDays ?? 7;
    
    // logic: advanceBookingDays = Total unique dates selectable starting from Today
    // 0 means only Today.
    const displayLimit = Math.max(1, limit);
    const allDates = Array.from({ length: displayLimit }, (_, i) => addDays(nowIst, i));
    
    if (!doctor || !doctor.availabilitySlots) return allDates;
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const availableDayIndices = doctor.availabilitySlots.map((s: any) => 
      typeof s.day === 'number' ? s.day : dayNames.indexOf(s.day)
    );

    const overriddenDates = doctor.dateOverrides ? Object.keys(doctor.dateOverrides) : [];

    return allDates.filter(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (overriddenDates.includes(dateStr)) {
          return (doctor.dateOverrides[dateStr] || []).length > 0;
        }
        return availableDayIndices.includes(date.getDay());
    });
  }, [doctor]);

  // 2. Data Fetching
  useEffect(() => {
    const fetchMeta = async () => {
      if (!doctorId) return;
      setFetchingDoctor(true);
      try {
        const d = await apiRequest<any>(`/doctors/${doctorId}`);
        setDoctor(d);
        
        if (patientId && clinicId) {
            const pData = await apiRequest<any>(`/patients/search?id=${patientId}&clinicId=${clinicId}`);
            setPatient(Array.isArray(pData) ? pData[0] : pData);
        }
      } catch (error) {
        console.error("Meta fetch error:", error);
      } finally {
        setFetchingDoctor(false);
      }
    };
    fetchMeta();
  }, [doctorId, patientId, clinicId]);

  // 3. Slot Retrieval
  const fetchSlots = useCallback(async () => {
    if (!doctorId || !clinicId || !selectedDate) return;
    setLoading(true);
    setSelectedSlot(null);
    try {
      const dateStr = format(selectedDate, 'd MMMM yyyy');
      const data = await apiRequest<any[]>(
        `/appointments/available-slots?doctorId=${doctorId}&clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}`
      );
      setSlots(data);

      const firstAvailable = data.find((s: any) => s.status === 'available');
      if (firstAvailable) setSelectedSlot(firstAvailable);
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Could not load availability.' });
    } finally {
      setLoading(false);
    }
  }, [doctorId, clinicId, selectedDate, toast]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // 4. Booking Command
  const handleBook = async () => {
    if (!selectedSlot || !patientId || !clinicId || !doctorId) return;
    setBooking(true);
    try {
      await apiRequest('/appointments/book-advanced', {
        method: 'POST',
        body: JSON.stringify({
          doctorId,
          clinicId,
          patientId,
          date: format(selectedDate, 'd MMMM yyyy'),
          slotTime: format(new Date(selectedSlot.time), 'HH:mm'),
          time: format(new Date(selectedSlot.time), 'HH:mm'),
          slotIndex: selectedSlot.slotIndex,
          sessionIndex: selectedSlot.sessionIndex,
          source: 'Phone'
        })
      });

      toast({ title: 'Success', description: 'Appointment booked successfully.' });
      router.push('/appointments');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setBooking(false);
    }
  };

  return {
    doctor, patient, slots, dates,
    selectedDate, setSelectedDate,
    selectedSlot, setSelectedSlot,
    loading, fetchingDoctor, booking,
    step, setStep,
    handleBook,
    router, doctorId, patientId
  };
}
