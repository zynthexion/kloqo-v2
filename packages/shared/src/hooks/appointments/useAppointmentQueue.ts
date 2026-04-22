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
  const todayVariations = useMemo(() => {
    const now = new Date(); // In a real browser, this is local. 
    // We should ideally use getClinicISODateString here, but let's be robust.
    // For now, we'll use a simple formatter that matches the backend bridge.
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const d = now.getDate();
    const m = now.getMonth();
    const y = now.getFullYear();
    
    return [
      `${d} ${monthNames[m]} ${y}`,
      `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
    ];
  }, []);

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
      const todayApts = appointments.filter(a => todayVariations.includes(a.date));

      for (const doctor of doctors) {
        const doctorApts = todayApts.filter(a => a.doctor === doctor.name);
        try {
          queues[doctor.name] = await computeQueues(
            doctorApts,
            doctor.name,
            doctor.id,
            clinicId,
            todayVariations[0],
            0
          );
        } catch (err) { /* Log silently */ }
      }
      setQueuesByDoctor(queues);
    };
    computeAllQueues();
  }, [appointments, todayVariations, clinicId, doctors, computeQueues]);

  return useMemo(() => ({
    filteredAppointments,
    queuesByDoctor,
    todayDateStr: todayVariations[0],
  }), [filteredAppointments, queuesByDoctor, todayVariations]);
}
