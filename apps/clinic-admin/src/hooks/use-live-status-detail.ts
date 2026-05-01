'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/api-client';
import { useSSE } from '@/hooks/use-sse';
import { getClinicNow, compareAppointments } from '@kloqo/shared-core';
import { parseTime } from '@/lib/utils';
import type { Doctor, Appointment } from '@kloqo/shared';

export function useLiveStatusDetail(id: string | string[] | undefined, currentUser: any) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDoctorAndAppointments = useCallback(async () => {
    if (!id || !currentUser) return;
    try {
      const now = getClinicNow();
      const todayStr = format(now, 'd MMMM yyyy');
      const [doctors, appointmentsData] = await Promise.all([
        apiRequest<Doctor[]>('/clinic/doctors'),
        apiRequest<Appointment[]>(`/clinic/appointments?doctorId=${id}&date=${todayStr}`)
      ]);

      const doctorData = doctors.find(d => d.id === id);
      if (doctorData) {
        setDoctor(doctorData);
        setAppointments(appointmentsData);
      }
    } catch (error) {
      console.error("Error fetching live status details: ", error);
    } finally {
      setLoading(false);
    }
  }, [id, currentUser]);

  useEffect(() => {
    fetchDoctorAndAppointments();
  }, [fetchDoctorAndAppointments]);

  useSSE({
    clinicId: doctor?.clinicId || currentUser?.clinicId,
    onEvent: useCallback((event) => {
      if (['appointment_status_changed', 'token_called', 'queue_updated', 'walk_in_created'].includes(event.type)) {
        fetchDoctorAndAppointments();
      }
    }, [fetchDoctorAndAppointments])
  });

  const tokenQueue = useMemo(() => {
    const sorted = [...appointments].sort(compareAppointments);
    const now = getClinicNow();
    const completed = sorted.filter(a => a.status === 'Completed' || parseTime(a.time, now) < now);
    const pending = sorted.filter(a => a.status !== 'Completed' && parseTime(a.time, now) >= now);

    return { all: sorted, completed, pending };
  }, [appointments]);

  return {
    doctor,
    tokenQueue,
    loading
  };
}
