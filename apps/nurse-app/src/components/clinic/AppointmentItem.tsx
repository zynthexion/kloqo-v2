'use client';

import React, { useRef } from 'react';
import type { Appointment } from '@kloqo/shared';
import { cn } from '@/lib/utils';
import { getClinicNow } from '@kloqo/shared-core';
import { motion } from 'framer-motion';
import { Star, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from './StatusBadge';
import { AppointmentTimeInfo } from './AppointmentTimeInfo';
import { AppointmentActions } from './AppointmentActions';
import { PatientDetails } from './PatientDetails';
import { KloqoRole } from '@kloqo/shared';

type AppointmentItemProps = {
  appt: Appointment;
  index: number;
  theme: string;
  isModern: boolean;
  isActionable: boolean;
  isInactive: boolean;
  isSwiping: boolean;
  isBuffer: boolean;
  isClinicOut: boolean;
  isSwipeOnCooldown: boolean;
  isCapturing: boolean;
  pendingCompletionId: string | null;
  firstActionableAppointmentId: string | null;
  showStatusBadge: boolean;
  showTopRightActions: boolean;
  showEstimatedTime: boolean;
  showPositionNumber: boolean;
  averageConsultingTime: number;
  currentTime: Date;
  activeRole?: KloqoRole | null;
  estimatedTime?: string;
  isFirstEstimated?: boolean;
  deadlineInfo: any;
  pressState: any;
  swipeStyle: React.CSSProperties;
  onSwipeStart: (e: any, id: string) => void;
  onSwipeMove: (e: any) => void;
  onSwipeEnd: () => void;
  onPressStart: (e: any, id: string) => void;
  onPressEnd: (e: any) => void;
  onCardTouchStart: (e: any, appt: Appointment) => void;
  onCardTouchMove: (e: any) => void;
  onCardTouchEnd: (e: any) => void;
  onUpdateStatus?: (id: string, status: any) => void;
  onRejoinQueue?: (appt: Appointment) => void;
  onAddToQueue?: (appt: Appointment) => void;
  onTogglePriority?: (appt: Appointment) => void;
  onViewPrescription?: (url: string) => void;
  onEditClick: (id: string) => void;
  triggerCamera: (id: string) => void;
  setSelectedAppointmentId: (id: string | null) => void;
  isAnimated: boolean;
};

export function AppointmentItem({
  appt,
  index,
  theme,
  isModern,
  isActionable,
  isInactive,
  isSwiping,
  isBuffer,
  isClinicOut,
  isSwipeOnCooldown,
  isCapturing,
  pendingCompletionId,
  showStatusBadge,
  showTopRightActions,
  showEstimatedTime,
  averageConsultingTime,
  currentTime,
  activeRole,
  estimatedTime,
  isFirstEstimated,
  deadlineInfo,
  pressState,
  swipeStyle,
  onCardTouchStart,
  onCardTouchMove,
  onCardTouchEnd,
  onUpdateStatus,
  onRejoinQueue,
  onAddToQueue,
  onViewPrescription,
  triggerCamera,
  setSelectedAppointmentId,
  isAnimated
}: AppointmentItemProps) {
  const CardWrapper = isAnimated ? motion.div : 'div';
  const swipedItemRef = useRef<HTMLDivElement | null>(null);
  const { deadline, liveDelay, gracePeriod, doctorStatus } = deadlineInfo;

  return (
    <CardWrapper
      layout={isAnimated ? "position" : undefined}
      initial={isAnimated ? { opacity: 0, y: 10 } : undefined}
      animate={isAnimated ? { opacity: 1, y: 0 } : undefined}
      exit={isAnimated ? { opacity: 0, x: -20 } : undefined}
      ref={isSwiping ? swipedItemRef : null}
      className={cn(
        "p-4 flex flex-col gap-3 border transition-all duration-200 relative mb-3",
        isModern ? "rounded-[2rem] border-white/50 bg-white shadow-premium" : "rounded-xl",
        isSwiping && 'text-white',
        !isModern && !isSwiping && "bg-white border-border shadow-md hover:shadow-lg",
        !isModern && !isSwiping && appt.status === 'Confirmed' && !appt.isPriority && "bg-green-50 border-green-200",
        !isModern && !isSwiping && appt.isPriority && "bg-amber-50 border-amber-400 shadow-md ring-1 ring-amber-400/50",
        !isModern && !isSwiping && isBuffer && !appt.isPriority && "bg-blue-50/80 border-blue-400",
        !isModern && !isSwiping && appt.skippedAt && "bg-amber-50/50 border-amber-400",
        !isModern && !isSwiping && appt.status === 'No-show' && "bg-red-50 border-red-200",
      )}
      style={swipeStyle}
      onMouseDown={(e) => onCardTouchStart(e, appt)}
      onTouchStart={(e) => onCardTouchStart(e, appt)}
      onClick={() => {
        if (activeRole === 'doctor') {
          const todayStr = getClinicNow().toISOString().split('T')[0];
          const isPast = (appt.date && appt.date < todayStr) || appt.status === 'Completed';
          if (isPast && appt.prescriptionUrl && onViewPrescription) {
            onViewPrescription(appt.prescriptionUrl);
          }
          return;
        }

        if (isActionable) {
          const isPhoneMode = false;
          if (isPhoneMode && ['Confirmed', 'Skipped'].includes(appt.status)) {
            triggerCamera(appt.id);
          } else {
            setSelectedAppointmentId(appt.id);
          }
        } else if (appt.status === 'Completed') {
          if (appt.prescriptionUrl && onViewPrescription) {
            onViewPrescription(appt.prescriptionUrl);
          } else {
            setSelectedAppointmentId(appt.id);
          }
        }
      }}
      onMouseMove={onCardTouchMove}
      onTouchMove={onCardTouchMove}
      onMouseUp={onCardTouchEnd}
      onTouchEnd={onCardTouchEnd}
      onMouseLeave={onCardTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isCapturing && pendingCompletionId === appt.id && (
        <div className="absolute inset-0 z-[60] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl space-y-2">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
           <span className="text-xs font-bold text-primary animate-pulse">UPLOADING...</span>
        </div>
      )}
      {pressState.type === 'priority' && pressState.id === appt.id && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 rounded-t-xl overflow-hidden z-20">
          <div
            className="h-full bg-amber-500 transition-all duration-[50ms] ease-linear"
            style={{ width: `${pressState.progress}%` }}
          />
        </div>
      )}
      <div
        className={cn(
          "transition-opacity duration-200",
          !isSwiping && appt.status === 'Skipped' && 'border-l-4 border-yellow-400 pl-2',
          !isSwiping && appt.status === 'Completed' && 'opacity-50',
          !isSwiping && appt.status === 'Cancelled' && (appt.cancellationReason === 'DOCTOR_LEAVE' ? 'border-l-4 border-orange-400 pl-2' : 'opacity-60'),
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <AppointmentTimeInfo 
                   appt={appt}
                   index={index}
                   showEstimatedTime={showEstimatedTime}
                   isFirstEstimated={isFirstEstimated}
                   doctorStatus={doctorStatus}
                   estimatedTime={estimatedTime}
                   currentTime={currentTime}
                   averageConsultingTime={averageConsultingTime}
                   isSwiping={isSwiping}
                   liveDelay={liveDelay}
                   gracePeriod={gracePeriod}
                   deadline={deadline}
                />
                
                {showStatusBadge && (
                  <StatusBadge 
                    status={appt.status} 
                    cancellationReason={appt.cancellationReason} 
                    isRescheduled={appt.isRescheduled} 
                    theme={theme} 
                  />
                )}
                {appt.isPriority && (
                  <Badge variant="default" className="ml-2 bg-amber-500 text-white hover:bg-amber-600 border-amber-600 flex gap-1 items-center">
                    <Star className="h-3 w-3 fill-current" />
                    Priority
                  </Badge>
                )}
                {!showStatusBadge && appt.status === 'Skipped' && (
                  <Badge variant="destructive" className="ml-2 bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-600">Late</Badge>
                )}

                <AppointmentActions 
                  appt={appt}
                  isActionable={isActionable}
                  showTopRightActions={showTopRightActions}
                  onUpdateStatus={onUpdateStatus}
                  onAddToQueue={onAddToQueue}
                  onRejoinQueue={onRejoinQueue}
                  isClinicOut={isClinicOut}
                />
              </div>

              <PatientDetails appt={appt} isSwiping={isSwiping} />
            </div>
          </div>
        </div>
      </div>
    </CardWrapper>
  );
}
