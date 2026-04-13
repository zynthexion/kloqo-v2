'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { parseTime } from '@/lib/utils';
import type { Doctor } from '@kloqo/shared';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * useAvailabilityState
 * Logic for managing doctor availability schedules, including mass-applying slots
 * to multiple days and synchronizing with the V2 REST API.
 */
export function useAvailabilityState() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [clinicDetails, setClinicDetails] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [sharedTimeSlots, setSharedTimeSlots] = useState<Array<{ from: string; to: string }>>([{ from: '09:00', to: '17:00' }]);

  // 1. Initial Load
  const fetchInitialData = useCallback(async () => {
    if (!user?.clinicId) return;
    setIsLoading(true);
    try {
      const data = await apiRequest<any>(`/appointments/dashboard?clinicId=${user.clinicId}&date=today`);
      setClinicDetails(data.clinic);
      setDoctors(data.doctors || []);
      
      if (data.doctors?.length > 0) {
        const storedId = localStorage.getItem('selectedDoctorId');
        const toSelect = data.doctors.find((d: Doctor) => d.id === storedId) || data.doctors[0];
        setSelectedDoctor(toSelect);
      }
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Could not load data.' });
    } finally {
      setIsLoading(false);
    }
  }, [user?.clinicId, toast]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  // 2. Doctor Selection
  const handleDoctorChange = (doctorId: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    setSelectedDoctor(doctor || null);
    localStorage.setItem('selectedDoctorId', doctorId);
    setIsEditingAvailability(false);
  };

  // 3. Save Operation
  const handleAvailabilitySave = async (values: any) => {
    if (!selectedDoctor) return;

    const validSlots = values.availabilitySlots
      .map((slot: any) => ({
        ...slot,
        timeSlots: slot.timeSlots.filter((ts: any) => ts.from && ts.to)
      }))
      .filter((slot: any) => slot.timeSlots.length > 0);

    const newSlots = validSlots.map((s: any) => ({
      ...s,
      timeSlots: [...s.timeSlots].sort((a,b) => a.from.localeCompare(b.from)).map((ts: any) => ({
        from: format(parseTime(ts.from, new Date()), 'HH:mm'),
        to: format(parseTime(ts.to, new Date()), 'HH:mm')
      }))
    }));

    const scheduleString = newSlots
      .sort((a: any, b: any) => daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day))
      .map((slot: any) => `${slot.day}: ${slot.timeSlots.map((ts: any) => `${ts.from}-${ts.to}`).join(', ')}`)
      .join('; ');

    startTransition(async () => {
      try {
        await apiRequest('/doctors/availability', {
          method: 'PATCH',
          body: JSON.stringify({
            doctorId: selectedDoctor.id,
            availabilitySlots: newSlots,
            schedule: scheduleString,
          })
        });

        const updated = { ...selectedDoctor, availabilitySlots: newSlots, schedule: scheduleString };
        setSelectedDoctor(updated);
        setDoctors(prev => prev.map(d => d.id === selectedDoctor.id ? updated : d));
        setIsEditingAvailability(false);
        toast({ title: 'Availability Updated' });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
      }
    });
  };

  return {
    doctors, selectedDoctor, clinicDetails, isLoading, isPending,
    isEditingAvailability, setIsEditingAvailability,
    selectedDays, setSelectedDays,
    sharedTimeSlots, setSharedTimeSlots,
    handleDoctorChange, handleAvailabilitySave,
    toast
  };
}
