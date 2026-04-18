'use client';

import { useTransition, useMemo, useCallback } from 'react';
import { useKloqo } from '../../context/KloqoContext';
import type { Appointment } from '../../index';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppointmentOperations {
  updateStatus: (id: string, status: Appointment['status'], time?: string, isPriority?: boolean) => Promise<any>;
  bookAppointment: (values: any) => Promise<any>;
  deleteAppointment: (id: string) => Promise<any>;
  sendBookingLink: (phone: string, name?: string) => Promise<any>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useAppointmentMutations (Shared)
 *
 * Handles all appointment state mutations: cancel, complete, skip, book, etc.
 * Reads `toast` from the KloqoProvider — no prop drilling needed.
 *
 * @param operations - The appointment mutation functions, typically sourced
 *   from the app-level data hook (e.g. useAppointments() in clinic-admin).
 */
export function useAppointmentMutations(operations: AppointmentOperations) {
  const { toast } = useKloqo();
  const [isPending, startTransition] = useTransition();

  const { updateStatus, bookAppointment, deleteAppointment, sendBookingLink } = operations;

  const handleCancel = useCallback((appointment: Appointment) => {
    startTransition(() => {
      (async () => {
        try {
          await updateStatus(appointment.id, 'Cancelled');
          toast({ title: 'Appointment Cancelled' });
        } catch (err) {
          toast({ title: 'Error', description: 'Could not cancel appointment.', variant: 'destructive' });
        }
      })();
    });
  }, [updateStatus, toast]);

  const handleComplete = useCallback((appointment: Appointment, onComplete?: () => void) => {
    startTransition(() => {
      (async () => {
        try {
          await updateStatus(appointment.id, 'Completed');
          toast({ title: 'Appointment Marked as Completed' });
          onComplete?.();
        } catch (err) {
          toast({ title: 'Error', description: 'Could not complete appointment.', variant: 'destructive' });
        }
      })();
    });
  }, [updateStatus, toast]);

  const handleAddToQueue = useCallback((appointment: Appointment) => {
    if (appointment.status !== 'Pending') return;
    startTransition(() => {
      (async () => {
        try {
          await updateStatus(appointment.id, 'Confirmed');
          toast({ title: 'Patient Added to Queue' });
        } catch (err) {
          toast({ title: 'Error', description: 'Could not add to queue.', variant: 'destructive' });
        }
      })();
    });
  }, [updateStatus, toast]);

  const handleSkip = useCallback((appointment: Appointment) => {
    startTransition(() => {
      (async () => {
        try {
          await updateStatus(appointment.id, 'Skipped');
          toast({ title: 'Appointment Skipped' });
        } catch (err) {
          toast({ title: 'Error', description: 'Could not skip appointment.', variant: 'destructive' });
        }
      })();
    });
  }, [updateStatus, toast]);

  const onMutationSubmit = useCallback(async (values: any, resetForm: () => void) => {
    try {
      await bookAppointment(values);
      resetForm();
      toast({ title: 'Appointment Created' });
    } catch (err: any) {
      toast({ title: 'Booking Failed', description: err.message, variant: 'destructive' });
    }
  }, [bookAppointment, toast]);

  return useMemo(() => ({
    isPending,
    handleCancel,
    handleComplete,
    handleAddToQueue,
    handleSkip,
    onMutationSubmit,
  }), [isPending, handleCancel, handleComplete, handleAddToQueue, handleSkip, onMutationSubmit]);
}
