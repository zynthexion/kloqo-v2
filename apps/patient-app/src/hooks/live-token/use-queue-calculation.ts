'use client';

import { useMemo } from 'react';
import type { Appointment, Doctor } from '@kloqo/shared';

/**
 * useQueueCalculation (Dumb Frontend Version)
 * 
 * This hook is now a pure pass-through for backend-calculated queue state.
 * It strictly follows Rule 16: No business logic in the frontend.
 */
export function useQueueCalculation({
    yourAppointment,
    queueState
}: {
    yourAppointment: Appointment | null;
    activeDoctorId: string;
    activeClinicId: string;
    currentDoctor: Doctor | null;
    allRelevantAppointments: Appointment[];
    clinicData: any;
    validBreaks: any[];
    currentTime: Date;
    appointmentDate: Date;
    consultationCount?: number;
    queueState?: any;
}) {
    // 1. Prioritize stable backend data
    const masterQueue = useMemo<any[]>(() => {
        return queueState?.masterQueue || [];
    }, [queueState]);

    const patientsAhead = useMemo(() => {
        return queueState?.patientsAhead ?? 0;
    }, [queueState]);

    const isYourTurn = useMemo(() => {
        return queueState?.yourTurn ?? (yourAppointment?.id === masterQueue[0]?.id && masterQueue.length > 0);
    }, [queueState, yourAppointment, masterQueue]);

    const currentTokenAppointment = useMemo(() => {
        return masterQueue[0] || null;
    }, [masterQueue]);

    return {
        queueState,
        masterQueue,
        currentTokenAppointment,
        isYourTurn,
        patientsAhead,
        // Legacy fields kept for interface compatibility but empty/minimal
        simulatedQueue: masterQueue,
        doctorAppointmentsToday: [], 
        arrivedEstimates: []
    };
}
