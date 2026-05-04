'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppointments } from '@/hooks/api/use-appointments';
import { useDoctors } from '@/hooks/api/use-doctors';
import { useLanguage } from '@/contexts/language-context';
import { useMasterDepartments } from '@/hooks/use-master-departments';
import { useLiveTokenListeners } from '@/hooks/use-live-token-listeners';
import { apiRequest } from '@/lib/api-client';
import { parseClinicDate } from '@/lib/utils';
import type { LiveTokenContextValue } from '@/contexts/LiveTokenContext';
import type { Doctor, Appointment } from '@kloqo/shared';

// Sub-hooks
import { useFamilyTokenState } from './live-token/use-family-token-state';
import { useQueueCalculation } from './live-token/use-queue-calculation';
import { useArrivalTiming } from './live-token/use-arrival-timing';
import { useLiveTokenActions } from './live-token/use-live-token-actions';
import { useCurrentTime } from './live-token/use-current-time';

import { NotificationService } from '@/services/NotificationService';

/**
 * useLiveTokenState (Orchestrator)
 */
export function useLiveTokenState(appointmentId: string | undefined): LiveTokenContextValue | { loading: boolean } {
    const { user, loading: userLoading } = useAuth();
    const { t, language } = useLanguage();
    const { departments } = useMasterDepartments();
    const { currentTime } = useCurrentTime();

    // Notification Guard State
    const [notifiedAlmostThere, setNotifiedAlmostThere] = useState(false);
    const [notifiedYourTurn, setNotifiedYourTurn] = useState(false);
    const { appointments: familyAppointments, loading: familyAppointmentsLoading } = useAppointments(user?.patientId);
    const clinicIdFromUser = (user as any)?.clinicId; // V2 roles might have it
    const clinicIds = useMemo(() => {
        if ((user as any)?.clinicIds) return (user as any).clinicIds;
        if (clinicIdFromUser) return [clinicIdFromUser];
        return [];
    }, [user]);

    const { doctors, loading: doctorsLoading } = useDoctors(clinicIds);

    // ... (logic remains similar)
    const {
        activeAppointmentBase,
        uniquePatientAppointments,
        visibleFamilyAppointments,
    } = useFamilyTokenState(familyAppointments, appointmentId);

    const doctor = useMemo(() => {
        if (!activeAppointmentBase) return null;
        return doctors.find((d: Doctor) => d.name === activeAppointmentBase.doctorName) || null;
    }, [doctors, activeAppointmentBase]);

    const activeDoctorId = doctor?.id || activeAppointmentBase?.doctorId || '';
    const activeClinicId = (doctor as any)?.clinicId || activeAppointmentBase?.clinicId || '';

    // Data-sync layer
    const {
        allRelevantAppointments,
        liveDoctor,
        consultationCount,
        clinics,
        loading: listenersLoading,
        liveDelay,
        queue: queueStatusData
    } = useLiveTokenListeners({
        clinicIds,
        doctorId: activeDoctorId,
        clinicId: activeClinicId,
        activeAppointment: activeAppointmentBase,
    });

    const yourAppointment = useMemo(() => {
        if (!activeAppointmentBase) return null;
        return allRelevantAppointments.find(a => a.id === activeAppointmentBase.id) || activeAppointmentBase;
    }, [activeAppointmentBase, allRelevantAppointments]);

    const yourAppointmentDoctor = liveDoctor || doctor;
    const currentDoctor = yourAppointmentDoctor;

    // Load static clinic data (one-shot) via API
    const [clinicData, setClinicData] = useState<any | null>(null);
    useEffect(() => {
        if (!activeClinicId) return;
        const fetchClinicData = async () => {
            try {
                const res = await apiRequest(`/clinics/${activeClinicId}`);
                if (res?.clinic) setClinicData(res.clinic);
            } catch (error) { console.error('Error fetching clinic data:', error); }
        };
        fetchClinicData();
    }, [activeClinicId]);

    // Compute Timing and Display values
    const timing = useArrivalTiming({
        yourAppointment,
        yourAppointmentDoctor,
        appointmentDate: timingDate(yourAppointment),
        language,
        t,
        currentTime,
        clinicData,
        queueState: queueStatusData, // Initial pass
        liveDelay
    });

    // Compute Queue state (Pure pass-through)
    const queue = useQueueCalculation({
        yourAppointment,
        activeDoctorId,
        activeClinicId,
        currentDoctor,
        allRelevantAppointments,
        clinicData,
        validBreaks: [], 
        currentTime,
        appointmentDate: timingDate(yourAppointment),
        consultationCount,
        queueState: queueStatusData
    });

    // Final timing pass with calculated queueState
    const finalTiming = useArrivalTiming({
        yourAppointment,
        yourAppointmentDoctor,
        appointmentDate: timingDate(yourAppointment),
        language,
        t,
        currentTime,
        clinicData,
        queueState: queue.queueState,
        liveDelay
    });

    // Encapsulated actions
    const actions = useLiveTokenActions(yourAppointment);

    // ── PROGRESSIVE NOTIFICATIONS: App-Only Waiting Room Replacement ──────────
    useEffect(() => {
        if (!yourAppointment || yourAppointment.status !== 'Confirmed') return;

        const { patientsAhead, isYourTurn } = queue;
        const token = yourAppointment.tokenNumber || '';

        // 1. "Almost There" Ping (Tokens Ahead === 1)
        if (patientsAhead === 1 && !notifiedAlmostThere) {
            NotificationService.notifyAlmostThere(token);
            setNotifiedAlmostThere(true);
        }

        // 2. "Your Turn" Alert (Direct Match)
        if (isYourTurn && !notifiedYourTurn) {
            NotificationService.notifyYourTurn(token);
            setNotifiedYourTurn(true);
            setNotifiedAlmostThere(true); // Ensure both are marked
        }

        // 3. Reset Guards if queue regresses (e.g., doctor skips back or patient is bubbled away)
        if (patientsAhead > 1 && (notifiedAlmostThere || notifiedYourTurn)) {
            setNotifiedAlmostThere(false);
            setNotifiedYourTurn(false);
        }
    }, [queue.patientsAhead, queue.isYourTurn, yourAppointment?.id, yourAppointment?.tokenNumber, yourAppointment?.status]);

    // Loading shim
    const isLoading = userLoading || familyAppointmentsLoading || doctorsLoading;
    if (isLoading) return { loading: true } as any;

    // Gating
    const isDoctorIn = currentDoctor?.consultationStatus === 'In';
    const isAppointmentToday = finalTiming.isAppointmentToday;
    const isConfirmedAppointment = yourAppointment?.status === 'Confirmed' || yourAppointment?.status === 'InConsultation';
    const isConsulting = yourAppointment?.status === 'InConsultation';
    const isSkippedAppointment = yourAppointment?.status === 'Skipped';

    return {
        yourAppointment,
        allTodaysAppointments: allRelevantAppointments,
        doctors,
        clinics: clinics as any[],
        clinicData,
        yourAppointmentDoctor,
        
        // Queue state from sub-hook
        queueState: queue.queueState,
        masterQueue: queue.masterQueue,
        simulatedQueue: queue.simulatedQueue,
        currentTokenAppointment: queue.currentTokenAppointment,
        patientsAhead: queue.patientsAhead,
        isYourTurn: queue.isYourTurn,
        
        // Live/Doctor state
        liveDoctor,
        currentDoctor,
        currentTime,
        
        // Computed values from timing sub-hook
        ...finalTiming,
        appointmentDate: timingDate(yourAppointment),
        isDoctorIn,
        validBreaks: [], // Logic moved to backend
        totalDelayMinutes: liveDelay,
        estimatedDelay: liveDelay,
        
        // Location & Actions
        locationStatus: 'idle', 
        locationError: null,
        locationDenied: false,
        locationCheckAttempted: false,
        ...actions,
        
        // Gating booleans
        shouldShowQueueVisualization: isDoctorIn && isAppointmentToday && (isConfirmedAppointment || yourAppointment?.status === 'Pending' || (isSkippedAppointment && clinicData?.tokenDistribution === 'classic')),
        shouldShowConfirmArrival: !isConfirmedAppointment && isAppointmentToday,
        shouldShowQueueInfo: isDoctorIn && isAppointmentToday && isConfirmedAppointment,
        shouldShowEstimatedWaitTime: true,
        
        isSkippedAppointment,
        isConfirmedAppointment,
        isConsulting,
        uniquePatientAppointments,
        t,
        language,
        departments,

        // 4-Quadrant Logic
        quadrant: !isDoctorIn 
            ? (isConfirmedAppointment ? 'OUT_CLINIC' : 'OUT_HOME')
            : (isConfirmedAppointment ? 'IN_CLINIC' : 'IN_HOME'),
        doctorStatusInfo: {
            ...finalTiming.doctorStatusInfo,
            awayReason: (currentDoctor as any)?.awayReason || '',
        }
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timingDate(appointment: any) {
    if (!appointment) return new Date();
    try {
        return parseClinicDate(appointment.date);
    } catch { return new Date(); }
}
