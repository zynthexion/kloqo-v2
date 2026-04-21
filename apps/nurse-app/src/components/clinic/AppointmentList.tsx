
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import type { Appointment } from '@kloqo/shared';
import { parse, subMinutes, format, addMinutes, isAfter } from 'date-fns';
import { cn, getDisplayTime } from '@/lib/utils';
import { displayTime12h, parseClinicTime, getClinic12hTimeString } from '@kloqo/shared-core';
import { Button } from '@/components/ui/button';
import { User, XCircle, Edit, Check, CheckCircle2, SkipForward, Phone, Star, Loader2 } from 'lucide-react';
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useRouter } from 'next/navigation';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { motion, AnimatePresence } from 'framer-motion';

const SWIPE_COOLDOWN_MS = 30 * 1000;
const ANIMATION_WINDOW = 8;

type SwipeState = { id: string | null; startX: number; currentX: number; width: number };
const createSwipeState = (): SwipeState => ({ id: null, startX: 0, currentX: 0, width: 0 });

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

// Local parser removed in favor of shared-core parseClinicTime

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

  // Check if Confirm Arrival button should be shown (show for pending, skipped, no-show)
  const shouldShowConfirmArrival = (appointment: Appointment): boolean => {
    return ['Pending', 'Skipped', 'No-show'].includes(appointment.status);
  };
  const [swipeState, setSwipeState] = useState<SwipeState>(createSwipeState);
  const swipeDataRef = useRef<SwipeState>(createSwipeState());
  // Long press for Skip & Priority
  const swipedItemRef = useRef<HTMLDivElement | null>(null);
  const [showSkipConfirm, setShowSkipConfirm] = useState<string | null>(null);
  const [pressState, setPressState] = useState<{ id: string | null; type: 'skip' | 'priority' | null; progress: number }>({ id: null, type: null, progress: 0 });
  const pressStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const startPosRef = useRef<{ x: number, y: number } | null>(null);

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    e.stopPropagation();
    // Prevent default to avoid text selection or other default behaviors
    if (e.type === 'touchstart') e.preventDefault();
    if (swipeState.id) return; // Don't start if swiping

    setPressState({ id, type: 'skip', progress: 0 });
    pressStartTimeRef.current = Date.now();

    // Animate progress bar
    const animate = () => {
      const elapsed = Date.now() - pressStartTimeRef.current;
      const progress = Math.min((elapsed / 3000) * 100, 100); // 3 seconds for skip

      setPressState(prev => ({ ...prev, progress }));

      if (progress < 100) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Completed
        setShowSkipConfirm(id);
        setPressState({ id: null, type: null, progress: 0 });
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const handlePressEnd = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
      // Only prevent default if it's a touch event to avoid blocking clicks
      if (e.type === 'touchend' && pressState.progress > 0) {
        // e.preventDefault(); // Don't prevent default here as it might block the actual end of touch
      }
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setPressState({ id: null, type: null, progress: 0 });
  };

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const handleCardTouchStart = (e: React.TouchEvent | React.MouseEvent, appt: Appointment) => {
    // If we are already handling a button press or swipe, ignore
    if (pressState.id || swipeState.id) return;

    if (swipeEnabled) handleSwipeStart(e as any, appt.id);

    // Only allow priority for Pending/Confirmed
    if (appt.status !== 'Pending' && appt.status !== 'Confirmed') return;
    if (appt.isPriority) return; // Already priority

    const touch = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    pressStartTimeRef.current = Date.now();

    // Start Priority Press
    setPressState({ id: appt.id, type: 'priority', progress: 0 });

    const animate = () => {
      const elapsed = Date.now() - pressStartTimeRef.current;
      const progress = Math.min((elapsed / 800) * 100, 100); // 800ms for priority

      setPressState(prev => ({ ...prev, progress }));

      if (progress < 100) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Completed
        if (onTogglePriority) onTogglePriority(appt);
        setPressState({ id: null, type: null, progress: 0 });
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  const handleCardTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (swipeEnabled) handleSwipeMove(e as any);

    // Check if moved too much for long press
    if (pressState.type === 'priority' && startPosRef.current) {
      const touch = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
      const dx = Math.abs(touch.clientX - startPosRef.current.x);
      const dy = Math.abs(touch.clientY - startPosRef.current.y);

      if (dx > 10 || dy > 10) { // Moved more than 10px
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        setPressState({ id: null, type: null, progress: 0 });
        startPosRef.current = null;
      }
    }
  };

  const handleCardTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (swipeEnabled) handleSwipeEnd();

    if (pressState.type === 'priority') {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      setPressState({ id: null, type: null, progress: 0 });
    }
    startPosRef.current = null;
  };
  /* eslint-enable @typescript-eslint/no-unused-vars */

  // Merge appointments and breaks for rendering
  const mixedItems = useMemo(() => {
    let items: Array<{ type: 'appointment' | 'break' | 'session-header'; data: any }> = [];

    const sortedBreaks = [...breaks]
      .filter(b => isAfter(new Date(b.endTime), currentTime))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const getApptTime = (apt: Appointment) => {
      const est = estimatedTimes.find(e => e.appointmentId === apt.id);
      if (est) {
        return parseClinicTime(est.estimatedTime, new Date());
      }
      return new Date(8640000000000000); // Push to end if no time
    };

    let breakIndex = 0;
    let lastSessionIndex = -1;

    appointments.forEach(apt => {
      const aptTime = getApptTime(apt);
      const currentSessionIndex = apt.sessionIndex ?? 0;

      while (breakIndex < sortedBreaks.length) {
        const brk = sortedBreaks[breakIndex];
        const brkStart = new Date(brk.startTime);

        if (brkStart.getTime() <= aptTime.getTime()) {
          items.push({ type: 'break', data: brk });
          breakIndex++;
        } else {
          break;
        }
      }

      if (currentSessionIndex !== lastSessionIndex) {
        items.push({ type: 'session-header', data: { sessionIndex: currentSessionIndex } });
        lastSessionIndex = currentSessionIndex;
      }

      items.push({ type: 'appointment', data: apt });
    });

    while (breakIndex < sortedBreaks.length) {
      items.push({ type: 'break', data: sortedBreaks[breakIndex] });
      breakIndex++;
    }

    if (items.length === 0 && appointments.length === 0 && breaks.length === 0) return [];

    return items;
  }, [appointments, breaks, estimatedTimes, currentTime]);

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

  const handleEditClick = (id: string) => {
    router.push(`/appointments/${id}/edit`);
  };

  const isActionable = (appt: Appointment) => appt.status === 'Pending' || appt.status === 'Confirmed' || appt.status === 'Skipped' || appt.status === 'No-show';
  const isInactive = (appt: Appointment) => ['Completed', 'Cancelled'].includes(appt.status);
  const isClinicOut = clinicStatus === 'Out';
  const swipeEnabled = enableSwipeCompletion && !!onUpdateStatus && !isClinicOut;

  const firstActionableAppointmentId = useMemo(() => {
    const actionableAppt = appointments.find(isActionable);
    return actionableAppt ? actionableAppt.id : null;
  }, [appointments]);

  useEffect(() => {
    if (firstActionableAppointmentId && (!selectedAppointmentId || !appointments.some(a => a.id === selectedAppointmentId))) {
      setSelectedAppointmentId(firstActionableAppointmentId);
    }
  }, [firstActionableAppointmentId, appointments, selectedAppointmentId]);

  const isSwipeOnCooldown = swipeCooldownUntil !== null && swipeEnabled;

  useEffect(() => {
    if (!swipeEnabled || swipeCooldownUntil === null) return;
    const remaining = Math.max(0, swipeCooldownUntil - Date.now());
    const timeout = window.setTimeout(() => {
      setSwipeCooldownUntil(null);
    }, remaining);
    return () => clearTimeout(timeout);
  }, [swipeCooldownUntil, swipeEnabled]);

  type SwipeEvent = ReactMouseEvent<HTMLDivElement> | ReactTouchEvent<HTMLDivElement>;

  const handleSwipeStart = (e: SwipeEvent, id: string) => {
    if (!swipeEnabled || isSwipeOnCooldown) return;

    const targetAppointment = appointments.find(a => a.id === id);
    if (!targetAppointment || !isActionable(targetAppointment)) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const target = e.currentTarget as HTMLElement | null;
    const width = target?.offsetWidth ?? 0;
    const nextState: SwipeState = { id, startX: clientX, currentX: clientX, width };
    swipeDataRef.current = nextState;
    setSwipeState(nextState);
  };

  const handleSwipeMove = (e: SwipeEvent) => {
    if (!swipeEnabled || swipeDataRef.current.id === null) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    swipeDataRef.current = { ...swipeDataRef.current, currentX: clientX };
    setSwipeState({ ...swipeDataRef.current });
  };

  const handleSwipeEnd = () => {
    if (!swipeEnabled || swipeDataRef.current.id === null) return;

    const { id, currentX, startX, width } = swipeDataRef.current;
    const deltaX = currentX - startX;
    const swipeWidth = width || swipedItemRef.current?.offsetWidth || 0;
    const swipeThreshold = swipeWidth * 0.6;

    if (swipeThreshold === 0) {
      const reset = createSwipeState();
      swipeDataRef.current = reset;
      setSwipeState(reset);
      return;
    }

    if (deltaX < -swipeThreshold) {
      setPendingCompletionId(id);
    }

    const reset = createSwipeState();
    swipeDataRef.current = reset;
    setSwipeState(reset);
  };

  const getSwipeStyle = (id: string): React.CSSProperties => {
    if (!swipeEnabled || swipeState.id !== id) return { transition: 'transform 0.2s ease-out, background-color 0.2s ease-out' };

    const deltaX = swipeState.currentX - swipeState.startX;
    const limitedDeltaX = Math.min(0, deltaX);
    const baseWidth = swipeState.width || swipedItemRef.current?.offsetWidth || 300;
    const opacity = Math.min(Math.abs(limitedDeltaX) / (baseWidth * 0.7 || 1), 0.7);

    return {
      transform: `translateX(${limitedDeltaX}px)`,
      backgroundColor: `rgba(4, 120, 87, ${opacity})`,
      transition: swipeState.id === null ? 'transform 0.2s ease-out, background-color 0.2s ease-out' : 'none',
    };
  };

  return (
    <>
      <TooltipProvider>
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
                <AnimatePresence initial={false}>
                  {mixedItems.map((item, index) => {
                  if (item.type === 'break') {
                    const brk = item.data;
                    const now = currentTime.getTime();
                    const breakStart = new Date(brk.startTime).getTime();
                    const breakEnd = new Date(brk.endTime).getTime();
                    const isBreakActive = now >= breakStart && now < breakEnd;

                    if (clinicStatus === 'In' && isBreakActive) {
                      return null;
                    }

                    const startLabel = format(new Date(brk.startTime), 'h:mm a');
                    const endLabel = format(new Date(brk.endTime), 'h:mm a');
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
                  const currentPos = appointmentCounter;
                  const isSwiping = swipeState.id === appt.id;
                  const isBuffer = isInBufferQueue && isInBufferQueue(appt);
                  const isModern = theme === 'modern';

                  const isAnimated = appointmentCounter <= ANIMATION_WINDOW;
                  const CardWrapper = isAnimated ? motion.div : 'div';

                  return (
                    <CardWrapper
                      key={appt.id}
                      layout={isAnimated ? "position" : undefined}
                      initial={isAnimated ? { opacity: 0, y: 10 } : undefined}
                      animate={isAnimated ? { opacity: 1, y: 0 } : undefined}
                      exit={isAnimated ? { opacity: 0, x: -20 } : undefined}
                      ref={swipeState.id === appt.id ? swipedItemRef : null}
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
                      style={getSwipeStyle(appt.id)}
                      onMouseDown={(e) => handleCardTouchStart(e, appt)}
                      onTouchStart={(e) => handleCardTouchStart(e, appt)}
                      onClick={() => {
                        if (isActionable(appt)) {
                          if (isPhoneMode && ['Confirmed', 'Skipped'].includes(appt.status)) {
                            triggerCamera(appt.id);
                          } else {
                            setSelectedAppointmentId(appt.id);
                          }
                        }
                      }}
                      onMouseMove={handleCardTouchMove}
                      onTouchMove={handleCardTouchMove}
                      onMouseUp={handleCardTouchEnd}
                      onTouchEnd={handleCardTouchEnd}
                      onMouseLeave={handleCardTouchEnd}
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
                                {(() => {
                                  if (showEstimatedTime) {
                                    const est = estimatedTimes.find(e => e.appointmentId === appt.id);
                                    if (est?.isFirst && clinicStatus === 'In') return null;

                                    const displayTime = est?.estimatedTime 
                                      ? displayTime12h(est.estimatedTime) 
                                      : (index === 0 ? '' : getClinic12hTimeString(addMinutes(currentTime, (averageConsultingTime || 15) * index)));
                                    if (!displayTime) return null;

                                    return (
                                      <Badge variant={isSwiping ? 'default' : 'outline'} className={cn("text-xs", isSwiping && 'bg-white/20 text-white')}>
                                        {appt.date && `${appt.date} - `}
                                        {displayTime}
                                      </Badge>
                                    );
                                  }

                                  return (
                                    <Badge variant={isSwiping ? 'default' : 'outline'} className={cn("text-xs", isSwiping && 'bg-white/20 text-white')}>
                                      {appt.date && `${appt.date} - `}
                                      {['Confirmed', 'Completed', 'Cancelled', 'No-show'].includes(appt.status) ? appt.time : getDisplayTime(appt.time)}
                                    </Badge>
                                  );
                                })()}
                                {showStatusBadge && getStatusBadge(appt)}
                                {appt.isPriority && (
                                  <Badge variant="default" className="ml-2 bg-amber-500 text-white hover:bg-amber-600 border-amber-600 flex gap-1 items-center">
                                    <Star className="h-3 w-3 fill-current" />
                                    Priority
                                  </Badge>
                                )}
                                {!showStatusBadge && appt.status === 'Skipped' && (
                                  <Badge variant="destructive" className="ml-2 bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-600">Late</Badge>
                                )}
                                {onUpdateStatus && isActionable(appt) && !showTopRightActions && (
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
                                    {appt.status === 'Confirmed' && !!onUpdateStatus && !showTopRightActions && (
                                      <div className="flex-1 flex items-center justify-between relative">
                                        {appt.id === firstActionableAppointmentId && (
                                          <div className="relative">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="outline"
                                                  size="icon"
                                                  className={cn(
                                                    "h-7 w-7 transition-all duration-200 relative overflow-hidden select-none touch-none",
                                                    pressState.id === appt.id ? "bg-yellow-100 border-yellow-300 scale-110" : "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200"
                                                  )}
                                                  disabled={isClinicOut}
                                                  onMouseDown={(e) => handlePressStart(e, appt.id)}
                                                  onTouchStart={(e) => handlePressStart(e, appt.id)}
                                                  onMouseUp={(e) => handlePressEnd(e)}
                                                  onMouseLeave={(e) => handlePressEnd(e)}
                                                  onTouchEnd={(e) => handlePressEnd(e)}
                                                  onContextMenu={(e) => e.preventDefault()}
                                                >
                                                  <SkipForward className="h-4 w-4 relative z-10 pointer-events-none" />
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>{pressState.id === appt.id ? "Hold to skip..." : "Hold 3s to Skip"}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                            {pressState.id === appt.id && (
                                              <div className="absolute -right-3 top-0 h-full w-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                  className="w-full bg-yellow-500 transition-all duration-[50ms] ease-linear absolute bottom-0"
                                                  style={{ height: `${pressState.progress}%` }}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {appt.id === selectedAppointmentId && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="default"
                                                size="icon"
                                                className={cn(
                                                  "h-10 w-10 text-white rounded-full shadow-lg ml-auto transition-all duration-300 hover:scale-110 hover:rotate-3",
                                                  theme === 'modern' ? "bg-primary shadow-primary/30" : "bg-green-600 hover:bg-green-700"
                                                )}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (isPhoneMode) {
                                                    triggerCamera(appt.id);
                                                  } else {
                                                    setPendingCompletionId(appt.id);
                                                  }
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                              >
                                                <Check className="h-6 w-6" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Complete Appointment</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-between items-start mt-1">
                                <div className="flex items-center gap-2">
                                  {showPositionNumber && (
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                      {currentPos}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <p className={cn("font-semibold", isInactive(appt) && 'line-through text-muted-foreground')}>
                                      {appt.tokenNumber 
                                        ? `${appt.tokenNumber} - ${appt.patientName}` 
                                        : appt.patientName}
                                    </p>
                                    {appt.skippedAt && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-200 border-amber-400 text-amber-800 leading-none flex items-center justify-center font-bold">
                                        Late
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                              </div>

                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {(appt.age && appt.place) && (
                                  <p className={cn("text-sm", isSwiping ? 'text-white/80' : 'text-muted-foreground')}>
                                    {appt.age} yrs, {appt.place}
                                  </p>
                                )}
                              </div>

                              {isPhoneMode && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-10 gap-2 bg-green-50 text-green-700 hover:bg-green-100 border-green-200 font-bold"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (appt.communicationPhone) {
                                        window.location.href = `tel:${appt.communicationPhone}`;
                                      }
                                    }}
                                  >
                                    <Phone className="h-4 w-4" />
                                    <span>Call {appt.communicationPhone || 'No Number'}</span>
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          {/* removed edit/delete icons for nurse dashboard consistency */}
                        </div>
                      </div>
                    </CardWrapper>
                  );
                  })}
                </AnimatePresence>
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
      </TooltipProvider >
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
