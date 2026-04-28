'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, addDays, subMinutes } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { getClinicNow, parseClinicDate, getClinicISOString, getClinicTimeString } from '@kloqo/shared-core';

export function useNurseBooking(doctorId: string | null, patientId: string | null) {
  const { toast } = useToast();
  const { user } = useAuth();
  const clinicId = user?.clinicId;

  const [selectedDate, setSelectedDate] = useState<Date>(getClinicNow());
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [step, setStep] = useState<'selection' | 'summary'>('selection');
  const [patient, setPatient] = useState<any>(null);
  const [doctor, setDoctor] = useState<any>(null);
  const [fetchingDoctor, setFetchingDoctor] = useState(true);

  const dates = useMemo(() => {
    const nowIst = getClinicNow();
    const todayBaselineIst = parseClinicDate(getClinicISOString(nowIst));
    const advanceBookingDays = doctor?.advanceBookingDays ?? 7;
    const allDates = Array.from({ length: advanceBookingDays + 1 }, (_, i) => addDays(todayBaselineIst, i));
    
    if (!doctor || !doctor.availabilitySlots) return allDates;
    
    const availableDays = doctor.availabilitySlots.map((s: any) => {
      if (typeof s.day === 'number') return s.day;
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return dayNames.indexOf(s.day);
    });

    const overriddenDates = doctor.dateOverrides ? Object.keys(doctor.dateOverrides) : [];

    return allDates.filter(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      if (overriddenDates.includes(dateStr)) {
        const daySlots = doctor.dateOverrides[dateStr];
        return daySlots && daySlots.length > 0;
      }
      return availableDays.includes(date.getDay());
    });
  }, [doctor]);

  useEffect(() => {
    const fetchPatient = async () => {
      if (!patientId || !clinicId) return;
      try {
        const data = await apiRequest<any>(`/patients/search?id=${patientId}&clinicId=${clinicId}`);
        const p = Array.isArray(data) ? data[0] : data;
        setPatient(p);
      } catch (error) {
        console.error("Error fetching patient:", error);
      }
    };
    fetchPatient();
  }, [patientId, clinicId]);

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!doctorId) return;
      setFetchingDoctor(true);
      try {
        const data = await apiRequest<any>(`/doctors/${doctorId}`);
        setDoctor(data);
      } catch (error) {
        console.error("Error fetching doctor:", error);
      } finally {
        setFetchingDoctor(false);
      }
    };
    fetchDoctor();
  }, [doctorId]);

  const fetchSlots = useCallback(async () => {
    if (!doctorId || !clinicId || !selectedDate) return;
    setLoading(true);
    setSelectedSlot(null);
    try {
      const dateStr = getClinicISOString(selectedDate);
      const response = await apiRequest<any>(
        `/appointments/available-slots?doctorId=${doctorId}&clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}`
      );
      const data = response.slots || [];
      setSlots(data);
      const firstAvailable = data.find((s: any) => s.status === 'available');
      if (firstAvailable) setSelectedSlot(firstAvailable);
    } catch (error) {
      console.error("Error fetching slots:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load availability.' });
    } finally {
      setLoading(false);
    }
  }, [doctorId, clinicId, selectedDate, toast]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleBook = useCallback(async (onSuccess: () => void) => {
    if (!selectedSlot || !patientId || !clinicId || !doctorId) return;
    setBooking(true);
    try {
      await apiRequest('/appointments/book', {
        method: 'POST',
        body: JSON.stringify({
          doctorId,
          clinicId,
          patientId,
          date: getClinicISOString(selectedDate),
          slotTime: getClinicTimeString(new Date(selectedSlot.time)),
          time: getClinicTimeString(new Date(selectedSlot.time)),
          slotIndex: selectedSlot.slotIndex,
          sessionIndex: selectedSlot.sessionIndex,
          source: 'Phone'
        })
      });
      toast({ title: 'Success', description: 'Appointment booked successfully.' });
      onSuccess();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setBooking(false);
    }
  }, [selectedSlot, patientId, clinicId, doctorId, selectedDate, toast]);

  return useMemo(() => ({
    selectedDate, setSelectedDate,
    slots, loading,
    booking, setBooking,
    selectedSlot, setSelectedSlot,
    step, setStep,
    patient, doctor,
    fetchingDoctor, dates,
    handleBook, user
  }), [
    selectedDate, slots, loading, booking, selectedSlot, step, 
    patient, doctor, fetchingDoctor, dates, handleBook, user
  ]);
}
