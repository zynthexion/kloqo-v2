'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Appointment } from '@kloqo/shared';
import { getClinicNow, parseClinicTime } from '@kloqo/shared-core';
import { isAfter } from 'date-fns';

type UseAppointmentLogicProps = {
  appointments: Appointment[];
  doctors: any[];
  currentTime: Date;
  onUpdateStatus?: (id: string, status: any) => void;
  enableSwipeCompletion?: boolean;
  breaks?: any[];
  estimatedTimes?: any[];
  allAppointments?: Appointment[];
};

export function useAppointmentLogic({
  appointments,
  doctors,
  currentTime,
  onUpdateStatus,
  enableSwipeCompletion,
  breaks,
  estimatedTimes,
  allAppointments
}: UseAppointmentLogicProps) {
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [swipeCooldownUntil, setSwipeCooldownUntil] = useState<number | null>(null);
  const [pendingCompletionId, setPendingCompletionId] = useState<string | null>(null);
  const [pressState, setPressState] = useState<{ id: string | null; type: 'skip' | 'priority' | null; progress: number }>({ id: null, type: null, progress: 0 });
  
  const pressStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  const calculateLiveDelay = useCallback((appt: Appointment) => {
    const doctor = doctors.find(d => d.id === appt.doctorId);
    if (!doctor) return 0;

    const sessionIndex = appt.sessionIndex || 0;
    const now = currentTime ? new Date(currentTime) : getClinicNow();
    const allApts = allAppointments || appointments; 

    const safeGetTime = (dateAny: any): number | null => {
      if (!dateAny) return null;
      if (typeof dateAny === 'number') return dateAny;
      if (dateAny instanceof Date) return dateAny.getTime();
      if (dateAny.toDate && typeof dateAny.toDate === 'function') return dateAny.toDate().getTime();
      const parsed = new Date(dateAny);
      return isNaN(parsed.getTime()) ? null : parsed.getTime();
    };

    if (doctor.consultationStatus !== 'In') {
      const doctorApts = allApts.filter(a => a.doctorId === doctor.id && a.sessionIndex === sessionIndex);
      if (doctorApts.length > 0) {
        const sortedApts = [...doctorApts].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        const earliestTimeStr = sortedApts[0].time;
        const sessionStart = parseClinicTime(earliestTimeStr, now);

        if (now > sessionStart) {
          const diffMs = now.getTime() - sessionStart.getTime();
          return Math.max(0, Math.floor(diffMs / (60 * 1000)));
        }
      }
      return 0;
    }

    const inConsultation = allApts.find(a => 
      a.doctorId === doctor.id && 
      a.status === 'InConsultation'
    );

    if (inConsultation) {
      const updatedAtTime = safeGetTime((inConsultation as any).updatedAt);
      const scheduledTime = parseClinicTime(inConsultation.time, now);
      
      if (updatedAtTime) {
        const diffMs = now.getTime() - updatedAtTime;
        const elapsed = Math.floor(diffMs / (60 * 1000));
        const avgTime = doctor.averageConsultingTime || 15;
        
        // 1. How much did this patient wait BEFORE starting?
        const waitBeforeStart = Math.max(0, Math.floor((updatedAtTime - scheduledTime.getTime()) / (60 * 1000)));
        
        // 2. How much extra time is this consultation taking?
        const overflow = Math.max(0, elapsed - avgTime);
        
        // Total delay they contribute to the rest of the queue
        return waitBeforeStart + overflow;
      }
    }

    const completedApts = allApts.filter(a => 
      a.doctorId === doctor.id && 
      a.status === 'Completed'
    ).sort((a, b) => safeGetTime((b as any).updatedAt || 0)! - safeGetTime((a as any).updatedAt || 0)!);

    if (completedApts.length > 0) {
      const lastCompleted = completedApts[0];
      const lastCompletedTime = safeGetTime((lastCompleted as any).updatedAt);
      if (lastCompletedTime) {
        const diffMs = now.getTime() - lastCompletedTime;
        const idleTime = Math.floor(diffMs / (60 * 1000));
        return Math.max(0, idleTime); 
      }
    }

    // Fallback: If session started but no one completed yet, delay is relative to first patient
    const arrivedApts = allApts.filter(a => 
      a.doctorId === doctor.id && 
      a.status === 'Confirmed'
    );
    
    if (arrivedApts.length > 0) {
      const sortedArrived = [...arrivedApts].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      const earliestTarget = parseClinicTime(sortedArrived[0].time, now);

      if (now > earliestTarget) {
        const diffMs = now.getTime() - earliestTarget.getTime();
        return Math.max(0, Math.floor(diffMs / (60 * 1000)));
      }
    }

    return 0;
  }, [doctors, currentTime, appointments, allAppointments]);

  const calculateDeadlineInfo = useCallback((appt: Appointment) => {
    if (!appt.time) return { deadline: null, liveDelay: 0, gracePeriod: 0, scheduledTime: null, doctorStatus: 'Out' };
    
    const doctor = doctors.find(d => d.id === appt.doctorId);
    const gracePeriod = doctor?.gracePeriodMinutes || 15;
    const liveDelay = calculateLiveDelay(appt);

    const baseDate = currentTime || getClinicNow();
    const scheduledTime = parseClinicTime(appt.time, baseDate);

    const deadline = new Date(scheduledTime.getTime() + (liveDelay + gracePeriod) * 60 * 1000);
    return {
      deadline: isNaN(deadline.getTime()) ? null : deadline,
      liveDelay,
      gracePeriod,
      scheduledTime,
      doctorStatus: doctor?.consultationStatus || 'Out'
    };
  }, [doctors, currentTime, calculateLiveDelay]);

  const isActionable = useCallback((appt: Appointment) => 
    appt.status === 'Pending' || appt.status === 'Confirmed' || appt.status === 'Skipped' || appt.status === 'No-show', []);

  const firstActionableAppointmentId = useMemo(() => {
    const actionableAppt = appointments.find(isActionable);
    return actionableAppt ? actionableAppt.id : null;
  }, [appointments, isActionable]);

  // Auto-Skip Logic
  useEffect(() => {
    if (!onUpdateStatus || !currentTime) return;

    const checkSkips = () => {
      appointments.forEach(appt => {
        if (appt.status === 'Pending') {
          const { deadline } = calculateDeadlineInfo(appt);
          if (deadline && currentTime > deadline) {
            console.log(`[Auto-Skip] Skipping ${appt.patientName} (${appt.id}) - Deadline was ${deadline.toLocaleTimeString()}`);
            onUpdateStatus(appt.id, 'Skipped');
          }
        }
      });
    };

    checkSkips();
  }, [appointments, currentTime, onUpdateStatus, calculateDeadlineInfo]);

  // Default selection
  useEffect(() => {
    if (firstActionableAppointmentId && (!selectedAppointmentId || !appointments.some(a => a.id === selectedAppointmentId))) {
      setSelectedAppointmentId(firstActionableAppointmentId);
    }
  }, [firstActionableAppointmentId, appointments, selectedAppointmentId]);

  // Swipe Cooldown
  useEffect(() => {
    if (!enableSwipeCompletion || swipeCooldownUntil === null) return;
    const remaining = Math.max(0, swipeCooldownUntil - getClinicNow().getTime());
    const timeout = window.setTimeout(() => {
      setSwipeCooldownUntil(null);
    }, remaining);
    return () => clearTimeout(timeout);
  }, [swipeCooldownUntil, enableSwipeCompletion]);

  const mixedItems = useMemo(() => {
    let items: Array<{ type: 'appointment' | 'break' | 'session-header'; data: any }> = [];

    const sortedBreaks = [...(breaks || [])]
      .filter(b => isAfter(parseClinicTime(b.endTime, currentTime), currentTime))
      .sort((a, b) => parseClinicTime(a.startTime, currentTime).getTime() - parseClinicTime(b.startTime, currentTime).getTime());

    const getApptTime = (apt: Appointment) => {
      const est = estimatedTimes?.find((e: any) => e.appointmentId === apt.id);
      if (est) {
        return parseClinicTime(est.estimatedTime, getClinicNow());
      }
      return new Date(8640000000000000); 
    };

    let breakIndex = 0;
    let lastSessionIndex = -1;

    appointments.forEach(apt => {
      const aptTime = getApptTime(apt);
      const currentSessionIndex = apt.sessionIndex ?? 0;

      while (breakIndex < sortedBreaks.length) {
        const brk = sortedBreaks[breakIndex];
        const brkStart = parseClinicTime(brk.startTime, currentTime);

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

    return items;
  }, [appointments, breaks, estimatedTimes, currentTime]);

  return {
    selectedAppointmentId,
    setSelectedAppointmentId,
    swipeCooldownUntil,
    setSwipeCooldownUntil,
    pendingCompletionId,
    setPendingCompletionId,
    pressState,
    setPressState,
    calculateDeadlineInfo,
    isActionable,
    firstActionableAppointmentId,
    isSwipeOnCooldown: swipeCooldownUntil !== null,
    mixedItems
  };
}
