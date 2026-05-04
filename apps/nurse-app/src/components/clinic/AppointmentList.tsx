'use client';

import { useRef, useState } from 'react';
import type { Appointment } from '@kloqo/shared';
import { cn } from '@/lib/utils';
import { displayTime12h, getClinicNow } from '@kloqo/shared-core';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { AnimatePresence } from 'framer-motion';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { useAppointmentLogic } from '@/hooks/use-appointment-logic';
import { AppointmentItem } from './AppointmentItem';

const ANIMATION_WINDOW = 8;

type AppointmentListProps = {
  appointments: Appointment[];
  onUpdateStatus?: (id: string, status: 'Completed' | 'Cancelled' | 'No-show' | 'Skipped' | 'InConsultation') => void;
  onRejoinQueue?: (appointment: Appointment) => void;
  onAddToQueue?: (appointment: Appointment) => void;
  showTopRightActions?: boolean;
  clinicStatus?: 'In' | 'Out';
  currentTime?: Date;
  isInBufferQueue?: (appointment: Appointment) => boolean;
  enableSwipeCompletion?: boolean;
  showStatusBadge?: boolean;
  isPhoneMode?: boolean;
  showPositionNumber?: boolean;
  showEstimatedTime?: boolean;
  averageConsultingTime?: number;
  estimatedTimes?: Array<{ appointmentId: string; estimatedTime: string; isFirst: boolean }>;
  breaks?: Array<{ id: string; startTime: string; endTime: string; note?: string }>;
  onTogglePriority?: (appointment: Appointment) => void;
  onViewPrescription?: (url: string) => void;
  onReschedule?: (appt: Appointment) => void;
};

export default function AppointmentList(props: AppointmentListProps) {
  const { theme } = useTheme();
  const { activeRole } = useActiveIdentity();
  const { completeWithPrescription, data } = useNurseDashboardContext();
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  const {
    appointments,
    onUpdateStatus,
    onRejoinQueue,
    onAddToQueue,
    showTopRightActions = true,
    clinicStatus = 'In',
    currentTime = getClinicNow(),
    isInBufferQueue,
    enableSwipeCompletion = true,
    showStatusBadge = true,
    showPositionNumber = false,
    showEstimatedTime = false,
    averageConsultingTime = 15,
    estimatedTimes = [],
    breaks = [],
    onTogglePriority,
    onViewPrescription,
    onReschedule
  } = props;

  const logic = useAppointmentLogic({
    appointments,
    doctors: data?.doctors || [],
    currentTime,
    onUpdateStatus,
    enableSwipeCompletion,
    breaks,
    estimatedTimes,
    allAppointments: data?.appointments || []
  });

  const {
    selectedAppointmentId,
    setSelectedAppointmentId,
    pendingCompletionId,
    setPendingCompletionId,
    pressState,
    calculateDeadlineInfo,
    isActionable,
    firstActionableAppointmentId,
    isSwipeOnCooldown,
    mixedItems
  } = logic;

  // Camera Handling
  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const apptId = pendingCompletionId || selectedAppointmentId;
    const appt = appointments.find(a => a.id === apptId);
    
    if (file && appt) {
      try {
        await completeWithPrescription(appt.id, appt.patientId, file, new Blob([], { type: 'image/png' }));
        setPendingCompletionId(null);
      } catch (err) {
        alert("Failed to upload photo. Please try again.");
      } finally {
        if (hiddenFileInputRef.current) hiddenFileInputRef.current.value = '';
      }
    }
  };

  const triggerCamera = (id: string) => {
    setPendingCompletionId(id);
    if (hiddenFileInputRef.current) hiddenFileInputRef.current.click();
  };

  const isClinicOut = clinicStatus === 'Out';

  const getSwipeStyle = (id: string): React.CSSProperties => {
    return { transition: 'transform 0.2s ease-out, background-color 0.2s ease-out' };
  };

  return (
    <TooltipProvider>
      <div className="flex-1">
        <div className="space-y-3 p-2 w-full max-w-full overflow-x-hidden">
          {enableSwipeCompletion && isSwipeOnCooldown && (
            <div className="text-xs text-amber-600 font-medium px-2">
              Swipe-to-complete is temporarily disabled for 30 seconds after each completion.
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={hiddenFileInputRef}
            className="hidden"
            onChange={handleCameraCapture}
          />

          {mixedItems.length > 0 ? (
            <AnimatePresence initial={false}>
              {mixedItems.map((item, index) => {
                if (item.type === 'break') {
                  return (
                    <div key={`break-${index}`} className="flex items-center justify-center p-3 bg-amber-50 rounded-lg border border-amber-100 text-amber-800 text-sm font-medium">
                      <span className="flex items-center gap-2">
                        <span className="block w-2 h-2 rounded-full bg-amber-500" />
                        Break: {displayTime12h(item.data.startTime)} - {displayTime12h(item.data.endTime)}
                      </span>
                    </div>
                  );
                }

                if (item.type === 'session-header') {
                  return (
                    <div key={`session-${item.data.sessionIndex}-${index}`} className="flex items-center gap-3 py-2 px-1">
                      <div className="flex-1 h-px bg-slate-200" />
                      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 font-bold uppercase tracking-wider text-[10px] px-2 py-0.5">
                         Session {item.data.sessionIndex + 1}
                      </Badge>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  );
                }

                const appt = item.data as Appointment;
                const est = estimatedTimes.find(e => e.appointmentId === appt.id);

                return (
                  <AppointmentItem
                    key={appt.id}
                    appt={appt}
                    index={index}
                    theme={theme}
                    isModern={theme === 'modern'}
                    isActionable={isActionable(appt)}
                    isInactive={['Completed', 'Cancelled'].includes(appt.status)}
                    isSwiping={false}
                    isBuffer={isInBufferQueue ? isInBufferQueue(appt) : (appt as any).isInBuffer === true}
                    isClinicOut={isClinicOut}
                    isSwipeOnCooldown={isSwipeOnCooldown}
                    isCapturing={false}
                    pendingCompletionId={pendingCompletionId}
                    firstActionableAppointmentId={firstActionableAppointmentId}
                    showStatusBadge={showStatusBadge}
                    showTopRightActions={showTopRightActions}
                    showEstimatedTime={showEstimatedTime}
                    showPositionNumber={showPositionNumber}
                    averageConsultingTime={averageConsultingTime}
                    currentTime={currentTime}
                    activeRole={activeRole}
                    estimatedTime={est?.estimatedTime}
                    isFirstEstimated={est?.isFirst}
                    deadlineInfo={calculateDeadlineInfo(appt)}
                    pressState={pressState}
                    swipeStyle={getSwipeStyle(appt.id)}
                    onSwipeStart={() => {}}
                    onSwipeMove={() => {}}
                    onSwipeEnd={() => {}}
                    onPressStart={() => {}}
                    onPressEnd={() => {}}
                    onCardTouchStart={() => {}}
                    onCardTouchMove={() => {}}
                    onCardTouchEnd={() => {}}
                    onUpdateStatus={onUpdateStatus}
                    onRejoinQueue={onRejoinQueue}
                    onAddToQueue={onAddToQueue}
                    onTogglePriority={onTogglePriority}
                    onViewPrescription={onViewPrescription}
                    onEditClick={() => {}}
                    triggerCamera={triggerCamera}
                    setSelectedAppointmentId={setSelectedAppointmentId}
                    isAnimated={index < ANIMATION_WINDOW}
                  />
                );
              })}
            </AnimatePresence>
          ) : (
            <div className="text-center py-20 text-slate-400">
              No appointments for this view.
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
