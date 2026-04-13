import { useState, useEffect, useCallback } from 'react';
import { useSSE } from './use-sse';
import { apiRequest } from '@/lib/api-client';
import { format } from 'date-fns';
import { computeQueues, type QueueState } from '@kloqo/shared-core';
import type { Appointment, Doctor } from '@kloqo/shared';

/**
 * Hook to manage queues for a specific doctor and session
 */
export function useQueueManagement(
  doctor: Doctor | null,
  date: Date,
  sessionIndex: number,
  enabled: boolean = true
) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [loading, setLoading] = useState(true);

  const dateStr = format(date, 'd MMMM yyyy');

    const fetchAppointments = useCallback(async () => {
      if (!enabled || !doctor || !doctor.id) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiRequest<Appointment[]>(`/clinic/appointments?doctorId=${doctor.id}&date=${dateStr}`);
        setAppointments(data);

        // Compute queues using the shared-core utility
        const queues = await computeQueues(
          data,
          doctor.name,
          doctor.id,
          doctor.clinicId,
          dateStr,
          sessionIndex
        );
        setQueueState(queues);
      } catch (error) {
        console.error('Error fetching appointments for queue:', error);
      } finally {
        setLoading(false);
      }
    }, [doctor?.id, doctor?.name, doctor?.clinicId, dateStr, sessionIndex, enabled]);

    useEffect(() => {
      fetchAppointments();
    }, [fetchAppointments]);

    // SSE: Real-time updates instead of 30s polling
    useSSE({
      clinicId: doctor?.clinicId,
      onEvent: useCallback((event) => {
        if (['appointment_status_changed', 'walk_in_created', 'queue_updated', 'token_called'].includes(event.type)) {
          fetchAppointments();
        }
      }, [fetchAppointments])
    });

  return {
    appointments,
    queueState,
    loading,
  };
}
