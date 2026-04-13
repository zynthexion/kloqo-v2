'use client';

import { useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Appointment } from '@kloqo/shared';

interface UseAppointmentMutationsProps {
  updateStatus: (id: string, status: Appointment['status'], time?: string, isPriority?: boolean) => Promise<any>;
  bookAppointment: (values: any) => Promise<any>;
  deleteAppointment: (id: string) => Promise<any>;
  sendBookingLink: (phone: string, name?: string) => Promise<any>;
  toast: any;
}

export function useAppointmentMutations({
  updateStatus,
  bookAppointment,
  deleteAppointment,
  sendBookingLink,
  toast,
}: UseAppointmentMutationsProps) {
  const [isPending, startTransition] = useTransition();

  const handleCancel = (appointment: Appointment) => {
    startTransition(async () => {
      try {
        await updateStatus(appointment.id, 'Cancelled');
        toast({ title: "Appointment Cancelled" });
      } catch (err) {}
    });
  };

  const handleComplete = (appointment: Appointment, onComplete?: () => void) => {
    startTransition(async () => {
      try {
        await updateStatus(appointment.id, 'Completed');
        toast({ title: "Appointment Marked as Completed" });
        if (onComplete) onComplete();
      } catch (err) {}
    });
  };

  const handleAddToQueue = (appointment: Appointment) => {
    if (appointment.status !== 'Pending') return;
    startTransition(async () => {
      try {
        await updateStatus(appointment.id, 'Confirmed');
        toast({ title: "Patient Added to Queue" });
      } catch (err) {}
    });
  };

  const onMutationSubmit = async (values: any, resetForm: () => void) => {
    try {
      await bookAppointment(values);
      resetForm();
      toast({ title: "Appointment Created" });
    } catch (err) {}
  };

  const handleSkip = (appointment: Appointment) => {
    startTransition(async () => {
      try {
        await updateStatus(appointment.id, 'Skipped');
        toast({ title: "Appointment Skipped" });
      } catch (err) {}
    });
  };

  return {
    isPending,
    startTransition,
    handleCancel,
    handleComplete,
    handleAddToQueue,
    onMutationSubmit,
    handleSkip,
  };
}
