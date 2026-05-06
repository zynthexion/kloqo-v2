'use client';

import { useMemo } from 'react';
import { 
    format, 
    isToday, 
    startOfDay, 
    addMinutes, 
    differenceInDays,
} from 'date-fns';
import { getClinicNow, displayTime12h } from '@kloqo/shared-core';
import { parseAppointmentDateTime, getArriveByTimeFromAppointment } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import type { Appointment, Doctor } from '@kloqo/shared';

/**
 * useArrivalTiming (Dumb Frontend Version - Re-stabilized)
 * 
 * Logic has been migrated to GetPublicQueueStatusUseCase (Backend).
 * This hook now purely formats data for display and satisfies the Context interface.
 */
export function useArrivalTiming({
    yourAppointment,
    yourAppointmentDoctor,
    appointmentDate,
    language,
    t,
    currentTime,
    queueState,
    liveDelay = 0
}: {
    yourAppointment: Appointment | null;
    yourAppointmentDoctor: Doctor | null;
    appointmentDate: Date;
    language: 'en' | 'ml';
    t: any;
    currentTime: Date;
    clinicData: any;
    queueState: any;
    liveDelay?: number;
}) {
    // 1. Core formatted date
    const formattedDate = useMemo(() => {
        if (!yourAppointment) return '';
        try {
            if (language === 'ml') {
                const day = format(appointmentDate, 'd');
                const month = formatDate(appointmentDate, 'MMMM', language);
                const year = format(appointmentDate, 'yyyy');
                return `${day} ${month} ${year}`;
            }
            return yourAppointment.date;
        } catch { return yourAppointment.date; }
    }, [yourAppointment, language, appointmentDate]);

    const isTodayAppointment = useMemo(() => {
        if (!yourAppointment) return false;
        try { return isToday(appointmentDate); } catch { return false; }
    }, [yourAppointment, appointmentDate]);

    const daysUntilAppointment = useMemo(() => {
        if (!yourAppointment) return null;
        try {
            const today = startOfDay(getClinicNow());
            const apptDay = startOfDay(appointmentDate);
            return differenceInDays(apptDay, today);
        } catch { return null; }
    }, [yourAppointment, appointmentDate]);

    // 2. Doctor Status Message (Driven by backend queueState)
    const breakMinutes = queueState?.breakMinutes ?? 0;
    const estimatedWaitTime = queueState?.estimatedWaitTime ?? 0;

    const sessionStartTime = useMemo(() => {
        if (!queueState?.masterQueue || queueState.currentSessionIndex === undefined) return null;
        const sessionIdx = queueState.currentSessionIndex;
        const slot = queueState.masterQueue.find((s: any) => s.sessionIndex === sessionIdx);
        return slot?.time ? new Date(slot.time) : null;
    }, [queueState]);

    const sessionStartTimeDisplay = useMemo(() => {
        if (!sessionStartTime) return '';
        return displayTime12h(format(sessionStartTime, 'HH:mm'));
    }, [sessionStartTime]);

    const doctorNextActionMessage = useMemo(() => {
        const isOut = yourAppointmentDoctor?.consultationStatus === 'Out' || yourAppointmentDoctor?.consultationStatus === 'Break';
        if (!isOut) return '';

        const isAtClinic = yourAppointment?.status === 'Confirmed' || yourAppointment?.status === 'InConsultation';

        if (breakMinutes > 0) {
            // Rule: For patients at the clinic, hide absolute time to prevent frustration.
            if (isAtClinic) {
                return language === 'ml' ? 'ഡോക്ടർ ബ്രേക്കിലാണ്' : 'Doctor on break';
            }

            if (sessionStartTimeDisplay) {
                return language === 'ml' 
                    ? `ഡോക്ടർ ${sessionStartTimeDisplay}ന് തുടങ്ങും` 
                    : `Doctor starting at ${sessionStartTimeDisplay}`;
            }
            return language === 'ml' ? 'ഡോക്ടർ ബ്രേക്കിലാണ്' : 'Doctor on break';
        }

        return language === 'ml' ? 'ഉടൻ തുടങ്ങും' : 'Starting soon';
    }, [yourAppointmentDoctor?.consultationStatus, breakMinutes, sessionStartTimeDisplay, language, yourAppointment?.status]);

    // 3. Arrive By Time Calculation
    const originalReportByTime = useMemo(() => {
        if (!yourAppointment) return '--';
        try { return getArriveByTimeFromAppointment(yourAppointment, yourAppointmentDoctor); } 
        catch { return yourAppointment.arriveByTime || yourAppointment.time || '--'; }
    }, [yourAppointment, yourAppointmentDoctor]);

    const reportByTimeDisplay = useMemo(() => {
        if (!yourAppointment) return '--';
        const base = originalReportByTime;
        const stableDelay = Math.floor(liveDelay / 10) * 10;
        if (stableDelay > 0) {
            try {
                const [time, modifier] = base.split(' ');
                let [hours, minutes] = time.split(':').map(Number);
                if (modifier?.toUpperCase() === 'PM' && hours < 12) hours += 12;
                if (modifier?.toUpperCase() === 'AM' && hours === 12) hours = 0;
                const d = getClinicNow();
                d.setHours(hours, minutes, 0, 0);
                return format(addMinutes(d, stableDelay), 'hh:mm a');
            } catch { return base; }
        }
        return base;
    }, [yourAppointment, originalReportByTime, liveDelay]);

    const arrivalReminderDateTime = useMemo(() => {
        if (!yourAppointment) return null;
        try {
            const baseTime = parseAppointmentDateTime(yourAppointment.date, originalReportByTime);
            const stableDelay = Math.floor(liveDelay / 10) * 10;
            return stableDelay > 0 ? addMinutes(baseTime, stableDelay) : baseTime;
        } catch { return null; }
    }, [yourAppointment, originalReportByTime, liveDelay]);

    const reportByDiffMinutes = useMemo(() => {
        if (!arrivalReminderDateTime) return null;
        const diff = Math.ceil((arrivalReminderDateTime.getTime() - currentTime.getTime()) / (1000 * 60));
        return diff;
    }, [arrivalReminderDateTime, currentTime]);

    const isReportingPastDue = useMemo(() => reportByDiffMinutes !== null && reportByDiffMinutes < 0, [reportByDiffMinutes]);

    const hoursUntilArrivalReminder = useMemo(() => {
        if (reportByDiffMinutes === null) return null;
        return Math.floor(Math.abs(reportByDiffMinutes) / 60);
    }, [reportByDiffMinutes]);

    const minutesUntilArrivalReminder = useMemo(() => {
        if (reportByDiffMinutes === null) return null;
        return Math.max(0, Math.floor(Math.abs(reportByDiffMinutes) % 60));
    }, [reportByDiffMinutes]);

    const reportingCountdownLabel = useMemo(() => {
        if (reportByDiffMinutes === null) return null;
        if (reportByDiffMinutes < 0) return language === 'ml' ? 'ഉടൻ എത്തുക' : 'Arrive Immediately';
        
        const inLabel = t.liveToken?.in ?? (language === 'ml' ? 'ഇനി' : 'In');
        const minLabel = language === 'ml' ? 'മിനിറ്റ്' : 'min';
        return `${inLabel} ${reportByDiffMinutes} ${minLabel}`;
    }, [reportByDiffMinutes, language, t]);

    return {
        formattedDate,
        isAppointmentToday: isTodayAppointment,
        daysUntilAppointment,
        doctorStatusInfo: {
            isBreak: breakMinutes > 0,
            isLate: false,
            isAffected: breakMinutes > 0,
            awayReason: '' // Placeholder to satisfy interface
        },
        breakMinutes,
        reportByTimeDisplay,
        originalReportByTime,
        reportByDiffMinutes,
        isReportingPastDue,
        hoursUntilArrivalReminder,
        minutesUntilArrivalReminder,
        reportingCountdownLabel,
        estimatedWaitTime,
        confirmedEstimatedWaitMinutes: estimatedWaitTime, // Aligned to backend
        sessionStartTime,
        sessionStartTimeDisplay,
        doctorNextActionMessage
    };
}
