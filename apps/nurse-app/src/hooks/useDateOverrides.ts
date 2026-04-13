'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { getClinicISODateString } from '@kloqo/shared-core';
import { useToast } from '@/hooks/use-toast';
import type { Doctor, DoctorOverride } from '@kloqo/shared';

export function useDateOverrides(doctor: Doctor, onUpdate: () => Promise<void>) {
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const updateOverrides = async (newOverrides: Record<string, DoctorOverride>, force: boolean = false) => {
    setIsPending(true);
    try {
      await apiRequest(`/doctors/${doctor.id}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({
          doctorId: doctor.id,
          dateOverrides: newOverrides,
          forceCancelConflicts: force
        }),
      });
      await onUpdate();
      toast({
        title: "Success",
        description: force ? "Conflicts resolved and overrides updated." : "Availability overrides updated successfully.",
      });
    } catch (error: any) {
      // Re-throw orphaned token errors so the component can handle them with a custom UI
      if (error.message?.includes('ORPHANED_TOKENS_DETECTED')) throw error;

      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update overrides.",
      });
    } finally {
      setIsPending(false);
    }
  };

  const addOverride = async (date: Date, override: DoctorOverride, force: boolean = false) => {
    const dateKey = getClinicISODateString(date);
    const newOverrides = {
      ...(doctor.dateOverrides || {}),
      [dateKey]: override,
    };
    await updateOverrides(newOverrides, force);
  };

  const removeOverride = async (dateKey: string) => {
    const newOverrides = { ...(doctor.dateOverrides || {}) };
    delete newOverrides[dateKey];
    await updateOverrides(newOverrides);
  };

  const markLeave = async (startDate: Date, endDate?: Date, force: boolean = false) => {
    setIsPending(true);
    try {
      await apiRequest('/doctors/mark-leave', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: doctor.id,
          startDate: getClinicISODateString(startDate),
          endDate: endDate ? getClinicISODateString(endDate) : undefined,
          forceCancelConflicts: force
        }),
      });
      await onUpdate();
      toast({
        title: "Success",
        description: "Doctor marked as on leave. Conflicts resolved.",
      });
    } catch (error: any) {
       // Re-throw orphaned token errors so the component can handle them with a custom UI
      if (error.message?.includes('ORPHANED_TOKENS_DETECTED')) throw error;

      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not mark leave.",
      });
    } finally {
      setIsPending(false);
    }
  };

  return {
    isPending,
    addOverride,
    removeOverride,
    markLeave,
  };
}
