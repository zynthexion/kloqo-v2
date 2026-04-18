'use client';

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import type { Appointment, Doctor } from '../../index';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseAppointmentQueueProps {
  appointments: Appointment[];
  doctors: Doctor[];
  clinicId?: string;
  drawerSearchTerm: string;
  selectedDrawerDoctor: string | null;
  /** 
   * Optional compute function injected by the app.
   * Allows apps to use their own `computeQueues` logic without the shared
   * hook having a hard dependency on a specific queue algorithm.
   */
  computeQueues?: (
    appointments: Appointment[],
    doctorName: string,
    doctorId: string,
    clinicId: string,
    dateStr: string,
    delay: number
  ) => Promise<any>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useAppointmentQueue (Shared)
 *
 * Manages appointment filtering and queue state computation across apps.
 * The actual `computeQueues` algorithm is injected to maintain isolation
 * from implementation-specific scheduling logic.
 */
export function useAppointmentQueue({
  appointments,
  doctors,
  clinicId,
  drawerSearchTerm,
  selectedDrawerDoctor,
  computeQueues,
}: UseAppointmentQueueProps) {
  const [queuesByDoctor, setQueuesByDoctor] = useState<Record<string, any>>({});
  const todayDateStr = useMemo(() => format(new Date(), 'd MMMM yyyy'), []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredAppointments = useMemo(() => {
    let filtered = appointments;
    const searchLower = drawerSearchTerm.toLowerCase();
    if (searchLower) {
      filtered = filtered.filter(apt =>
        apt.patientName?.toLowerCase().includes(searchLower) ||
        apt.doctor?.toLowerCase().includes(searchLower)
      );
    }
    if (selectedDrawerDoctor && selectedDrawerDoctor !== 'all') {
      filtered = filtered.filter(apt => apt.doctor === selectedDrawerDoctor);
    }
    return filtered;
  }, [appointments, drawerSearchTerm, selectedDrawerDoctor]);

  // ── Queue Computation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!computeQueues) return; // Queue computation is optional
    const computeAllQueues = async () => {
      if (!clinicId || !doctors.length) return;
      const queues: Record<string, any> = {};
      const todayApts = appointments.filter(a => a.date === todayDateStr);

      for (const doctor of doctors) {
        const doctorApts = todayApts.filter(a => a.doctor === doctor.name);
        try {
          queues[doctor.name] = await computeQueues(
            doctorApts,
            doctor.name,
            doctor.id,
            clinicId,
            todayDateStr,
            0
          );
        } catch (err) { /* Log silently */ }
      }
      setQueuesByDoctor(queues);
    };
    computeAllQueues();
  }, [appointments, todayDateStr, clinicId, doctors, computeQueues]);

  return useMemo(() => ({
    filteredAppointments,
    queuesByDoctor,
    todayDateStr,
  }), [filteredAppointments, queuesByDoctor, todayDateStr]);
}
