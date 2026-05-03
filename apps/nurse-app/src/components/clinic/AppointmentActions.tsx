'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CheckCircle2 } from 'lucide-react';
import type { Appointment } from '@kloqo/shared';

type AppointmentActionsProps = {
  appt: Appointment;
  isActionable: boolean;
  showTopRightActions: boolean;
  onUpdateStatus?: (id: string, status: any) => void;
  onAddToQueue?: (appt: Appointment) => void;
  onRejoinQueue?: (appt: Appointment) => void;
  isClinicOut: boolean;
};

export function AppointmentActions({
  appt,
  isActionable,
  showTopRightActions,
  onUpdateStatus,
  onAddToQueue,
  onRejoinQueue,
  isClinicOut
}: AppointmentActionsProps) {
  if (!onUpdateStatus || !isActionable || showTopRightActions) return null;

  const shouldShowConfirmArrival = (appointment: Appointment): boolean => {
    return ['Pending', 'Skipped', 'No-show'].includes(appointment.status);
  };

  return (
    <div className="flex-1 flex items-center gap-2 ml-2">
      {(appt.status === 'Pending' || appt.status === 'Skipped' || appt.status === 'No-show') && (onAddToQueue || onRejoinQueue) && shouldShowConfirmArrival(appt) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              onClick={() => (onRejoinQueue && (appt.status === 'Skipped' || appt.status === 'No-show')) ? onRejoinQueue(appt) : onAddToQueue?.(appt)}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Confirm Arrival</p>
          </TooltipContent>
        </Tooltip>
      )}
      {appt.status === 'Confirmed' && !!onUpdateStatus && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-sm"
              onClick={() => onUpdateStatus(appt.id, 'InConsultation')}
              disabled={isClinicOut}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Start
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Start Consultation</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
