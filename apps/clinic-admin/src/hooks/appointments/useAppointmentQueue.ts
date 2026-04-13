'use client';

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  computeQueues, 
  type QueueState 
} from '@kloqo/shared-core';
import type { Appointment, Doctor } from '@kloqo/shared';

interface UseAppointmentQueueProps {
  appointments: Appointment[];
  doctors: Doctor[];
  clinicId?: string;
  drawerSearchTerm: string;
  selectedDrawerDoctor: string | null;
}

export function useAppointmentQueue({
  appointments,
  doctors,
  clinicId,
  drawerSearchTerm,
  selectedDrawerDoctor,
}: UseAppointmentQueueProps) {
  const [queuesByDoctor, setQueuesByDoctor] = useState<Record<string, QueueState>>({});
  const todayDateStr = useMemo(() => format(new Date(), "d MMMM yyyy"), []);

  const filteredAppointments = useMemo(() => {
    let filtered = appointments;
    const searchTermLower = drawerSearchTerm.toLowerCase();
    if (searchTermLower) {
      filtered = filtered.filter(apt => 
        (apt.patientName?.toLowerCase().includes(searchTermLower)) ||
        (apt.doctor?.toLowerCase().includes(searchTermLower))
      );
    }
    if (selectedDrawerDoctor && selectedDrawerDoctor !== 'all') {
      filtered = filtered.filter(apt => apt.doctor === selectedDrawerDoctor);
    }
    return filtered;
  }, [appointments, drawerSearchTerm, selectedDrawerDoctor]);

  useEffect(() => {
    const computeAllQueues = async () => {
      if (!clinicId || !doctors.length) return;
      const queues: Record<string, QueueState> = {};
      const todayApts = appointments.filter(a => a.date === todayDateStr);
      
      for (const doctor of doctors) {
        const doctorApts = todayApts.filter(a => a.doctor === doctor.name);
        try {
          queues[doctor.name] = await computeQueues(doctorApts, doctor.name, doctor.id, clinicId, todayDateStr, 0);
        } catch (err) {}
      }
      setQueuesByDoctor(queues);
    };
    computeAllQueues();
  }, [appointments, todayDateStr, clinicId, doctors]);

  return {
    filteredAppointments,
    queuesByDoctor,
    todayDateStr,
  };
}
