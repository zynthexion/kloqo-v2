'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { format, parse, isToday, differenceInMinutes } from 'date-fns';
import { apiRequest } from '@/lib/api-client';
import { useSSE } from '@/hooks/use-sse';
import { getClinicNow, compareAppointments } from '@kloqo/shared-core';
import { parseTime } from '@/lib/utils';
import type { Doctor, Appointment } from '@kloqo/shared';

export type EnrichedDoctor = Doctor & {
  currentToken?: string;
  pendingTokens: number;
  delayMinutes?: number;
};

export function useLiveStatus(currentUser: any) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(getClinicNow());

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const now = getClinicNow();
      const todayStr = format(now, "d MMMM yyyy");
      const [doctorsData, appointmentsData] = await Promise.all([
        apiRequest<Doctor[]>('/clinic/doctors'),
        apiRequest<Appointment[]>(`/clinic/appointments?date=${todayStr}`)
      ]);

      setDoctors(doctorsData);
      setAppointments(appointmentsData);
    } catch (error) {
      console.error("Error fetching live status data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useSSE({
    clinicId: currentUser?.clinicId,
    onEvent: useCallback((event) => {
      if (['appointment_status_changed', 'walk_in_created', 'queue_updated', 'token_called'].includes(event.type)) {
        fetchData();
      }
    }, [fetchData])
  });

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(getClinicNow()), 60000);
    return () => clearInterval(timerId);
  }, []);

  const enrichedDoctors: EnrichedDoctor[] = useMemo(() => {
    const now = getClinicNow();
    return doctors.map(doctor => {
      const doctorAppointments = appointments
        .filter(apt => apt.doctor === doctor.name && isToday(parse(apt.date, 'd MMMM yyyy', now)))
        .sort(compareAppointments);

      const pending = doctorAppointments.filter(apt => ['Pending', 'Confirmed'].includes(apt.status));
      const currentAppointment = pending[0];

      let delayMinutes: number | undefined;
      if (currentAppointment) {
        try {
          const appointmentTime = parseTime(currentAppointment.time, now);
          const diff = differenceInMinutes(currentTime, appointmentTime);
          delayMinutes = Math.max(0, diff);
        } catch {
          delayMinutes = undefined;
        }
      }

      return {
        ...doctor,
        currentToken: currentAppointment?.tokenNumber,
        pendingTokens: pending.length,
        delayMinutes,
      }
    })
  }, [doctors, appointments, currentTime]);

  return {
    enrichedDoctors,
    loading,
    currentTime
  };
}
