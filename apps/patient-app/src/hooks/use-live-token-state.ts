'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppointments } from '@/hooks/api/use-appointments';
import { useDoctors } from '@/hooks/api/use-doctors';
import { useLanguage } from '@/contexts/language-context';
import { useMasterDepartments } from '@/hooks/use-master-departments';
import { useLiveTokenListeners } from '@/hooks/use-live-token-listeners';
import { apiRequest } from '@/lib/api-client';
import type { LiveTokenContextValue } from '@/contexts/LiveTokenContext';
import type { Doctor, Appointment } from '@kloqo/shared';

// Sub-hooks
import { useFamilyTokenState } from './live-token/use-family-token-state';
import { useQueueCalculation } from './live-token/use-queue-calculation';
import { useArrivalTiming } from './live-token/use-arrival-timing';
import { useLiveTokenActions } from './live-token/use-live-token-actions';
import { useCurrentTime } from './live-token/use-current-time';

/**
 * useLiveTokenState (Orchestrator)
 * 
 * This hook is now a "Dumb Orchestrator" following the modular pattern.
 * It coordinates multiple sub-hooks to provide a unified context for the Live Token page.
 */
export function useLiveTokenState(appointmentId: string | undefined): LiveTokenContextValue | { loading: boolean } {
    const { user, loading: userLoading } = useAuth();
    const { t, language } = useLanguage();
    const { departments } = useMasterDepartments();
    const { currentTime } = useCurrentTime();

    // 1. Data Fetching (Listeners / SWR)
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
        clinics,
        loading: listenersLoading
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
        validBreaks: calculateValidBreaks(currentDoctor, yourAppointment, allRelevantAppointments),
        currentTime,
        clinicData,
        doctorAppointmentsToday: [], // Will be handled inside useQueueCalculation effectively
        masterQueue: [], // Placeholder, will be updated by dependencies if needed
        arrivedEstimates: [] // Placeholder
    });

    // Compute Queue state
    const queue = useQueueCalculation({
        yourAppointment,
        activeDoctorId,
        activeClinicId,
        currentDoctor,
        allRelevantAppointments,
        clinicData,
        validBreaks: calculateValidBreaks(currentDoctor, yourAppointment, allRelevantAppointments),
        currentTime,
        appointmentDate: timingDate(yourAppointment)
    });

    // Re-bind timing to queue outputs for wait-time estimations
    const finalTiming = useArrivalTiming({
        yourAppointment,
        yourAppointmentDoctor,
        appointmentDate: timingDate(yourAppointment),
        language,
        t,
        validBreaks: calculateValidBreaks(currentDoctor, yourAppointment, allRelevantAppointments),
        currentTime,
        clinicData,
        doctorAppointmentsToday: queue.doctorAppointmentsToday,
        masterQueue: queue.masterQueue,
        arrivedEstimates: queue.arrivedEstimates
    });

    // Encapsulated actions
    const actions = useLiveTokenActions(yourAppointment);

    // Loading shim
    const isLoading = userLoading || familyAppointmentsLoading || doctorsLoading;
    if (isLoading) return { loading: true } as any;

    // Gating
    const isDoctorIn = currentDoctor?.consultationStatus === 'In';
    const isAppointmentToday = finalTiming.isAppointmentToday;
    const isConfirmedAppointment = yourAppointment?.status === 'Confirmed';
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
        validBreaks: calculateValidBreaks(currentDoctor, yourAppointment, allRelevantAppointments),
        totalDelayMinutes: 0, // Simplified or extracted if needed
        estimatedDelay: 0, // Simplified or extracted if needed
        
        // Location & Actions
        locationStatus: 'idle', // Managed by useArrivalState in larger flow or here
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
        uniquePatientAppointments,
        t,
        language,
        departments
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timingDate(appointment: any) {
    if (!appointment) return new Date();
    try {
        const { parse } = require('date-fns');
        return parse(appointment.date, "d MMMM yyyy", new Date());
    } catch { return new Date(); }
}

function calculateValidBreaks(doctor: any, appointment: any, appointments: any[]) {
    if (!doctor?.breakPeriods || !appointment) return [];
    try {
        const { format, parse } = require('date-fns');
        const appointmentDate = parse(appointment.date, "d MMMM yyyy", new Date());
        const dateKey = format(appointmentDate, 'd MMMM yyyy');
        const breaks = doctor.breakPeriods[dateKey] || [];
        return breaks.filter((bp: any) => {
            const isCancelled = appointments.some(appt =>
                appt.status === 'Cancelled' &&
                appt.cancelledByBreak === true &&
                (appt.time === bp.startTimeFormatted || appt.id === bp.id)
            );
            return !isCancelled;
        });
    } catch { return []; }
}
