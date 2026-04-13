'use client';

import { useState, useRef, useMemo } from 'react';
import type { Appointment } from '@kloqo/shared';
import { isAfter } from 'date-fns';
import { displayTime12h, parseClinicTime } from '@kloqo/shared-core';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/contexts/ThemeContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from 'next/navigation';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

import { useSwipeable } from './hooks/use-swipeable';
import { useAppointmentInteractions } from './hooks/use-appointment-interactions';
import { useAppointmentQueueBuilder } from './hooks/use-appointment-queue-builder';
import { AppointmentCard } from './AppointmentCard';

const SWIPE_COOLDOWN_MS = 30 * 1000;

type AppointmentListProps = {
  appointments: Appointment[];
  onUpdateStatus?: (id: string, status: 'completed' | 'Cancelled' | 'No-show' | 'Skipped') => void;
  onRejoinQueue?: (appointment: Appointment) => void;
  onAddToQueue?: (appointment: Appointment) => void | ((appointment: Appointment) => void);
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
  tokenDistribution?: 'classic' | 'advanced';
};

export default function AppointmentList({
  appointments,
  onUpdateStatus,
  onRejoinQueue,
  onAddToQueue,
  showTopRightActions = true,
  clinicStatus = 'In',
  currentTime = new Date(),
  isInBufferQueue,
  enableSwipeCompletion = true,
  showStatusBadge = true,
  isPhoneMode = false,
  showPositionNumber = false,
  showEstimatedTime = false,
  averageConsultingTime = 15,
  estimatedTimes = [],
  breaks = [],
  onTogglePriority,
  tokenDistribution = 'advanced'
}: AppointmentListProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { completeWithPrescription } = useNurseDashboardContext();
  const [pendingCompletionId, setPendingCompletionId] = useState<string | null>(null);
  const [swipeCooldownUntil, setSwipeCooldownUntil] = useState<number | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  const isClinicOut = clinicStatus === 'Out';
  const swipeEnabled = enableSwipeCompletion && !!onUpdateStatus && !isClinicOut;
  const isSwipeOnCooldown = swipeCooldownUntil !== null && swipeEnabled;

  const { 
    swipeState, 
    swipedItemRef, 
    handleSwipeStart, 
    handleSwipeMove, 
    handleSwipeEnd, 
    getSwipeStyle 
  } = useSwipeable({
    swipeEnabled: swipeEnabled && !isSwipeOnCooldown,
    onSwipeComplete: (id) => setPendingCompletionId(id)
  });

  const {
    pressState,
    showSkipConfirm,
    setShowSkipConfirm,
    handlePressStart,
    handlePressEnd,
    handleCardTouchStart,
    handleCardTouchMove,
    handleCardTouchEnd
  } = useAppointmentInteractions({
    swipeEnabled: swipeEnabled && !isSwipeOnCooldown,
    onSwipeStart: handleSwipeStart,
    onSwipeMove: handleSwipeMove,
    onSwipeEnd: handleSwipeEnd,
    onPriorityToggle: onTogglePriority,
    onSkipComplete: (id) => setShowSkipConfirm(id)
  });

  const getStatusBadge = (appt: Appointment) => {
    const isModern = theme === 'modern';
    switch (appt.status) {
      case 'No-show':
        return <Badge variant="destructive" className={cn(isModern && "bg-red-500/10 text-red-600 border-none rounded-full px-3")}>No-show</Badge>
      case 'Pending':
        return <Badge variant="secondary" className={cn(isModern && "bg-slate-500/10 text-slate-600 border-none rounded-full px-3")}>Pending</Badge>
      case 'Confirmed':
        return <Badge variant="default" className={cn(isModern && "bg-primary/10 text-primary border-none rounded-full px-3")}>Confirmed</Badge>
      case 'Cancelled':
        if (appt.cancellationReason === 'DOCTOR_LEAVE') {
          return <Badge variant="destructive" className={cn("bg-orange-500 text-white", isModern && "bg-orange-500/10 text-orange-600 border-none rounded-full px-3")}>Doctor Leave</Badge>;
        }
        if (appt.isRescheduled) {
          return (
            <Badge
              variant="outline"
              className={cn("bg-orange-100 text-orange-800 border-orange-200", isModern && "bg-amber-500/10 text-amber-600 border-none rounded-full px-3")}
            >
              Rescheduled
            </Badge>
          );
        }
        return <Badge variant="secondary" className={cn(isModern && "bg-slate-400/10 text-slate-500 border-none rounded-full px-3")}>Cancelled</Badge>
      case 'Completed':
        return <Badge variant="default" className={cn("bg-green-600", isModern && "bg-green-500/10 text-green-600 border-none rounded-full px-3")}>Completed</Badge>
      case 'Skipped':
        return <Badge variant="destructive" className={cn("bg-yellow-500 text-white", isModern && "bg-yellow-500/10 text-yellow-600 border-none rounded-full px-3")}>Skipped</Badge>;
      default:
        return null;
    }
  }

  const shouldShowConfirmArrival = (appointment: Appointment): boolean => {
    return ['Pending', 'Skipped', 'No-show'].includes(appointment.status);
  };

  const isActionable = (appt: Appointment) => appt.status === 'Pending' || appt.status === 'Confirmed' || appt.status === 'Skipped' || appt.status === 'No-show';
  const isInactive = (appt: Appointment) => ['Completed', 'Cancelled'].includes(appt.status);

  const firstActionableAppointmentId = useMemo(() => {
    const actionableAppt = appointments.find(isActionable);
    return actionableAppt ? actionableAppt.id : null;
  }, [appointments]);

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const apptId = pendingCompletionId || selectedAppointmentId;
    const appt = appointments.find(a => a.id === apptId);
    
    if (file && appt) {
      setIsCapturing(true);
      try {
        await completeWithPrescription(appt.id, appt.patientId, file);
        setPendingCompletionId(null);
      } catch (err) {
        alert("Failed to upload photo. Please try again.");
      } finally {
        setIsCapturing(false);
        if (hiddenFileInputRef.current) hiddenFileInputRef.current.value = '';
      }
    }
  };

  const triggerCamera = (id: string) => {
    setPendingCompletionId(id);
    if (hiddenFileInputRef.current) {
      hiddenFileInputRef.current.click();
    }
  };

  const { mixedItems } = useAppointmentQueueBuilder({
    appointments,
    breaks,
    estimatedTimes,
    currentTime
  });

  return (
    <>
      <div
        className="flex-1"
        onMouseUp={swipeEnabled ? handleSwipeEnd : undefined}
        onMouseLeave={swipeEnabled ? handleSwipeEnd : undefined}
        onTouchEnd={swipeEnabled ? handleSwipeEnd : undefined}
        onMouseMove={swipeEnabled ? handleSwipeMove : undefined}
        onTouchMove={swipeEnabled ? handleSwipeMove : undefined}
      >
        <div className="space-y-3 p-2">
          {swipeEnabled && isSwipeOnCooldown && (
            <div className="text-xs text-amber-600 font-medium px-2">
              Swipe-to-complete is temporarily disabled for 30 seconds after each completion.
            </div>
          )}

          {(() => {
            let appointmentCounter = 0;
            return mixedItems.length > 0 ? (
              mixedItems.map((item, index) => {
                if (item.type === 'break') {
                  const brk = item.data;
                  const now = currentTime.getTime();
                  const breakStart = new Date(brk.startTime).getTime();
                  const breakEnd = new Date(brk.endTime).getTime();
                  const isBreakActive = now >= breakStart && now < breakEnd;

                  if (clinicStatus === 'In' && isBreakActive) {
                    return null;
                  }

                  return (
                    <div key={`break-${index}`} className="flex items-center justify-center p-3 bg-amber-50 rounded-lg border border-amber-100 text-amber-800 text-sm font-medium">
                      <span className="flex items-center gap-2">
                        <span className="block w-2 h-2 rounded-full bg-amber-500" />
                        Break: {displayTime12h(brk.startTime)} - {displayTime12h(brk.endTime)} {brk.note ? `(${brk.note})` : ''}
                      </span>
                    </div>
                  );
                }

                if (item.type === 'session-header') {
                  const sessionIdx = item.data.sessionIndex;
                  return (
                    <div key={`session-${sessionIdx}-${index}`} className="flex items-center gap-3 py-2 px-1">
                      <div className="flex-1 h-px bg-slate-200" />
                      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 font-bold uppercase tracking-wider text-[10px] px-2 py-0.5">
                          Session {sessionIdx + 1}
                      </Badge>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  );
                }

                appointmentCounter++;
                const appt = item.data as Appointment;
                const isSwiping = swipeState.id === appt.id;

                return (
                  <AppointmentCard
                    key={appt.id}
                    ref={isSwiping ? swipedItemRef : null}
                    appt={appt}
                    index={index}
                    currentPos={appointmentCounter}
                    isSwiping={isSwiping}
                    swipeStyle={getSwipeStyle(appt.id)}
                    isBuffer={isInBufferQueue ? isInBufferQueue(appt) : false}
                    isActionable={isActionable(appt)}
                    isPhoneMode={isPhoneMode}
                    isInactive={isInactive(appt)}
                    isClinicOut={isClinicOut}
                    theme={theme}
                    
                    showPositionNumber={showPositionNumber}
                    showEstimatedTime={showEstimatedTime}
                    showStatusBadge={showStatusBadge}
                    showTopRightActions={showTopRightActions}
                    averageConsultingTime={averageConsultingTime}
                    currentTime={currentTime}
                    estimatedTimes={estimatedTimes}
                    
                    selectedAppointmentId={selectedAppointmentId}
                    firstActionableAppointmentId={firstActionableAppointmentId}
                    pendingCompletionId={pendingCompletionId}
                    pressState={pressState}
                    isCapturing={isCapturing}
                    
                    getStatusBadge={getStatusBadge}
                    shouldShowConfirmArrival={shouldShowConfirmArrival}
                    tokenDistribution={tokenDistribution}
                    
                    onCardTouchStart={(e, a) => handleCardTouchStart(e, a, isSwiping)}
                    onCardTouchMove={handleCardTouchMove}
                    onCardTouchEnd={handleCardTouchEnd}
                    onPressStart={(e, id) => handlePressStart(e, id, isSwiping)}
                    onPressEnd={handlePressEnd}
                    onCardClick={() => {
                      if (isActionable(appt)) {
                        if (isPhoneMode && ['Confirmed', 'Skipped'].includes(appt.status)) {
                          triggerCamera(appt.id);
                        } else {
                          setSelectedAppointmentId(appt.id);
                        }
                      }
                    }}
                    onCompleteClick={(e) => {
                      e.stopPropagation();
                      if (isPhoneMode) {
                        triggerCamera(appt.id);
                      } else {
                        setPendingCompletionId(appt.id);
                      }
                    }}
                    onCallClick={(e) => {
                      if (appt.communicationPhone) {
                        window.location.href = `tel:${appt.communicationPhone}`;
                      }
                    }}
                    
                    onUpdateStatus={!!onUpdateStatus}
                    onAddToQueue={onAddToQueue}
                    onRejoinQueue={onRejoinQueue}
                  />
                );
              })
            ) : (
              <div className="h-24 flex items-center justify-center text-center text-muted-foreground">
                <p>No appointments found for the selected criteria.</p>
              </div>
            )
          })()}
          
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={hiddenFileInputRef} 
            className="hidden" 
            onChange={handleCameraCapture}
          />
        </div>
      </div>
      
      {swipeEnabled && (
        <AlertDialog open={!!pendingCompletionId} onOpenChange={(open) => !open && setPendingCompletionId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete Appointment?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to mark this appointment as completed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingCompletionId(null)}>No, Go Back</AlertDialogCancel>
              <AlertDialogAction
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  if (pendingCompletionId && onUpdateStatus) {
                    onUpdateStatus(pendingCompletionId, 'completed');
                    setPendingCompletionId(null);
                    setSwipeCooldownUntil(Date.now() + SWIPE_COOLDOWN_MS);
                  }
                }}
              >
                Yes, Complete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showSkipConfirm && (
        <AlertDialog open={!!showSkipConfirm} onOpenChange={(open) => !open && setShowSkipConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Skip Appointment?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the current patient as "Late" and move them to the end of the arrived queue (or buffer).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowSkipConfirm(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-yellow-600 hover:bg-yellow-700"
                onClick={() => {
                  if (showSkipConfirm && onUpdateStatus) {
                    onUpdateStatus(showSkipConfirm, 'Skipped');
                    setShowSkipConfirm(null);
                  }
                }}
              >
                Yes, Skip Patient
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
