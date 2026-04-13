'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
    computeQueues, 
    type QueueState, 
    compareAppointments, 
    compareAppointmentsClassic, 
    calculateEstimatedTimes, 
    buildSimulatedQueue 
} from '@kloqo/shared-core';
import { format, isAfter, isBefore, differenceInMinutes, addMinutes, parseISO } from 'date-fns';
import { parseTime } from '@/lib/utils';
import type { Appointment, Doctor } from '@kloqo/shared';

export function useQueueCalculation({
    yourAppointment,
    activeDoctorId,
    activeClinicId,
    currentDoctor,
    allRelevantAppointments,
    clinicData,
    validBreaks,
    currentTime,
    appointmentDate
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
}) {
    const [queueState, setQueueState] = useState<QueueState | null>(null);

    // Compute live queue state
    useEffect(() => {
        if (!yourAppointment || !activeDoctorId || !activeClinicId || !currentDoctor) return;

        const compute = async () => {
            try {
                const state = await computeQueues(
                    allRelevantAppointments as any,
                    (yourAppointment as any).doctor || yourAppointment.doctorName,
                    activeDoctorId,
                    activeClinicId,
                    yourAppointment.date,
                    yourAppointment.sessionIndex ?? 0,
                    (currentDoctor.consultationStatus as any),
                    clinicData?.tokenDistribution === 'advanced' ? 'advanced' : 'classic'
                );
                setQueueState(state);
            } catch (error) {
                console.error('Error computing queues:', error);
            }
        };
        compute();
    }, [allRelevantAppointments, yourAppointment, activeDoctorId, activeClinicId, currentDoctor, clinicData]);

    // Arrived estimates for individual patients
    const arrivedEstimates = useMemo(() => {
        if (!currentDoctor || !queueState?.arrivedQueue) return [];
        const virtualDoctor = {
            ...currentDoctor,
            breakPeriods: {
                ...(currentDoctor as any).breakPeriods,
                [format(appointmentDate, 'd MMMM yyyy')]: validBreaks
            }
        };
        return calculateEstimatedTimes(
            queueState.arrivedQueue as any,
            virtualDoctor as any,
            currentTime,
            currentDoctor.averageConsultingTime || 15
        );
    }, [queueState?.arrivedQueue, currentDoctor, currentTime, validBreaks, appointmentDate]);

    // Simulated queue considering distributions
    const simulatedQueue = useMemo<Appointment[]>(() => {
        if (!yourAppointment || !allRelevantAppointments || !clinicData) {
            return queueState?.arrivedQueue as any || [];
        }
        const relevantAppointments = allRelevantAppointments.filter(apt =>
            ((apt as any).doctor || apt.doctorName) === ((yourAppointment as any).doctor || yourAppointment.doctorName) &&
            apt.date === yourAppointment.date &&
            apt.status !== 'Cancelled' &&
            apt.status !== 'No-show'
        );

        return buildSimulatedQueue(
            relevantAppointments as any,
            clinicData.tokenDistribution || 'classic',
            new Date(),
            yourAppointment.id
        ) as any;
    }, [yourAppointment, allRelevantAppointments, clinicData, queueState?.arrivedQueue]);

    // Final master queue
    const masterQueue = useMemo<Appointment[]>(() => {
        if (simulatedQueue.length > 0 || (clinicData && yourAppointment)) return simulatedQueue;
        return (queueState?.arrivedQueue as any) || [];
    }, [simulatedQueue, queueState, clinicData, yourAppointment]);

    const currentTokenAppointment = useMemo(() => masterQueue[0] || null, [masterQueue]);
    const isYourTurn = useMemo(() => yourAppointment?.id === currentTokenAppointment?.id, [yourAppointment, currentTokenAppointment]);

    // Doctor's total upcoming appointments for today
    const doctorAppointmentsToday = useMemo(() => {
        if (!yourAppointment) return [];
        return allRelevantAppointments
            .filter(apt =>
                ((apt as any).doctor || apt.doctorName) === ((yourAppointment as any).doctor || yourAppointment.doctorName) &&
                apt.date === yourAppointment.date &&
                apt.status !== 'Cancelled' &&
                apt.status !== 'No-show' &&
                apt.status !== 'Completed'
            )
            .sort((clinicData?.tokenDistribution === 'classic' ? compareAppointmentsClassic : compareAppointments) as any) as any;
    }, [allRelevantAppointments, yourAppointment, clinicData]);

    // Core patients ahead metric
    const patientsAhead = useMemo(() => {
        if (!yourAppointment) return 0;
        if (clinicData?.tokenDistribution === 'classic') {
            const confirmed = doctorAppointmentsToday.filter((a: any) => a.status === 'Confirmed');
            const yourIndex = confirmed.findIndex((a: any) => a.id === yourAppointment.id);
            if (yourIndex !== -1) return yourIndex;
            return confirmed.filter((a: any) => a.id !== yourAppointment.id).length;
        }
        const yourIndex = masterQueue.findIndex(a => a.id === yourAppointment.id);
        return yourIndex === -1 ? 0 : yourIndex;
    }, [yourAppointment, masterQueue, clinicData, doctorAppointmentsToday]);

    return {
        queueState,
        masterQueue,
        simulatedQueue,
        currentTokenAppointment,
        isYourTurn,
        doctorAppointmentsToday,
        patientsAhead,
        arrivedEstimates
    };
}
