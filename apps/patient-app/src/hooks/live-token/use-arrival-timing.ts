'use client';

import { useMemo } from 'react';
import { 
    format, 
    isToday, 
    differenceInMinutes, 
    differenceInDays, 
    differenceInHours, 
    startOfDay, 
    parse, 
    addMinutes, 
    subMinutes, 
    isAfter, 
    isBefore, 
    parseISO 
} from 'date-fns';
import { parseAppointmentDateTime, parseTime, getArriveByTimeFromAppointment } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import type { Appointment, Doctor } from '@kloqo/shared';

export function useArrivalTiming({
    yourAppointment,
    yourAppointmentDoctor,
    appointmentDate,
    language,
    t,
    validBreaks,
    currentTime,
    clinicData,
    doctorAppointmentsToday,
    masterQueue,
    arrivedEstimates
}: {
    yourAppointment: Appointment | null;
    yourAppointmentDoctor: Doctor | null;
    appointmentDate: Date;
    language: 'en' | 'ml';
    t: any;
    validBreaks: any[];
    currentTime: Date;
    clinicData: any;
    doctorAppointmentsToday: Appointment[];
    masterQueue: Appointment[];
    arrivedEstimates: any[];
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
            const today = startOfDay(new Date());
            const apptDay = startOfDay(appointmentDate);
            return differenceInDays(apptDay, today);
        } catch { return null; }
    }, [yourAppointment, appointmentDate]);

    // 2. Doctor status/Break logic
    const doctorStatusInfo = useMemo(() => {
        if (!yourAppointment || !yourAppointmentDoctor?.availabilitySlots) {
            return { isLate: false, isBreak: false, isAffected: false };
        }
        try {
            const appointmentDateTime = parseAppointmentDateTime(yourAppointment.date, yourAppointment.time);
            const breaks = validBreaks;
            if (breaks.length === 0) return { isLate: false, isBreak: false, isAffected: false };

            const dayOfWeekIndex = appointmentDateTime.getDay();
            const dayAvailability = yourAppointmentDoctor.availabilitySlots.find(slot => String(slot.day) === String(dayOfWeekIndex));
            if (!dayAvailability || !dayAvailability.timeSlots.length) return { isLate: false, isBreak: false, isAffected: false };

            const firstSession = dayAvailability.timeSlots[0];
            const firstSlotTime = parseTime(firstSession.from, appointmentDateTime);

            const affectingBreak = breaks.find((bp: any) => {
                const start = parseISO(bp.startTime);
                const end = parseISO(bp.endTime);
                return isBefore(appointmentDateTime, end) && isAfter(appointmentDateTime, start);
            });

            const isAffected = !!affectingBreak;
            let isLate = false;
            let isBreak = false;

            if (isAffected && affectingBreak) {
                const bpStart = parseISO(affectingBreak.startTime);
                if (differenceInMinutes(bpStart, firstSlotTime) <= 30) isLate = true;
                else isBreak = true;
            }
            return { isLate, isBreak, isAffected };
        } catch { return { isLate: false, isBreak: false, isAffected: false }; }
    }, [yourAppointment, yourAppointmentDoctor, validBreaks]);

    const breakMinutes = useMemo(() => {
        if (!yourAppointment || !yourAppointmentDoctor?.breakPeriods) return 0;
        try {
            const appointmentDateTime = parseAppointmentDateTime(yourAppointment.date, yourAppointment.time);
            const breaks = validBreaks;
            if (breaks.length === 0) return 0;
            const now = new Date();
            const isDoctorWorking = yourAppointmentDoctor?.consultationStatus === 'In';

            for (const bp of breaks) {
                const end = parseISO(bp.endTime);
                const start = parseISO(bp.startTime);
                if (isAfter(now, start) && isBefore(now, end)) {
                    if (isDoctorWorking) return 0;
                    if (isBefore(appointmentDateTime, start)) continue;
                    return Math.max(0, differenceInMinutes(end, now));
                }
            }
            return 0;
        } catch { return 0; }
    }, [yourAppointment, yourAppointmentDoctor, currentTime, validBreaks]);

    // 3. Reporting Window
    const arrivalReminderDateTime = useMemo(() => {
        if (!yourAppointment) return null;
        try {
            const arriveByString = getArriveByTimeFromAppointment(yourAppointment, yourAppointmentDoctor);
            return parse(arriveByString, "hh:mm a", appointmentDate);
        } catch {
            try {
                const scheduledDateTime = parseAppointmentDateTime(yourAppointment.date, yourAppointment.time);
                const isWalkIn = yourAppointment.tokenNumber?.startsWith('W');
                return isWalkIn ? scheduledDateTime : subMinutes(scheduledDateTime, 15);
            } catch { return null; }
        }
    }, [yourAppointment, yourAppointmentDoctor, appointmentDate]);

    const reportByTimeDisplay = useMemo(() => {
        if (!yourAppointment) return '--';
        try { return getArriveByTimeFromAppointment(yourAppointment, yourAppointmentDoctor); } 
        catch { return yourAppointment.arriveByTime || yourAppointment.time || '--'; }
    }, [yourAppointment, yourAppointmentDoctor]);

    const reportByDiffMinutes = useMemo(() => {
        if (!arrivalReminderDateTime) return null;
        return differenceInMinutes(arrivalReminderDateTime, currentTime);
    }, [arrivalReminderDateTime, currentTime]);

    const isReportingPastDue = useMemo(() => reportByDiffMinutes !== null && reportByDiffMinutes < 0, [reportByDiffMinutes]);

    const reportingCountdownLabel = useMemo(() => {
        if (reportByDiffMinutes === null) return null;
        const minutesValue = Math.abs(reportByDiffMinutes);
        
        const inLabel = t.liveToken?.in ?? (language === 'ml' ? 'ഇനി' : 'In');
        const daySingular = t.liveToken?.day ?? (language === 'ml' ? 'ദിവസം' : 'day');
        const dayPlural = t.liveToken?.days ?? (language === 'ml' ? 'ദിവസങ്ങൾ' : 'days');
        const hourSingular = t.liveToken?.hour ?? (language === 'ml' ? 'മണിക്കൂർ' : 'hour');
        const hourPlural = t.liveToken?.hours ?? (language === 'ml' ? 'മണിക്കൂർ' : 'hours');
        const minuteSingular = t.liveToken?.minutes ?? (language === 'ml' ? 'മിനിറ്റ്' : 'minute');
        const minutePlural = t.liveToken?.minutes ?? (language === 'ml' ? 'മിനിറ്റുകൾ' : 'minutes');

        const formatLabel = (value: number, singular: string, plural: string) => {
            const absValue = Math.max(1, value);
            const unitLabel = absValue === 1 ? singular : plural;
            return reportByDiffMinutes < 0 ? `-${absValue} ${unitLabel}` : `${inLabel} ${absValue} ${unitLabel}`;
        };

        if (minutesValue >= 1440) return formatLabel(Math.floor(minutesValue / 1440), daySingular, dayPlural);
        if (minutesValue >= 60) {
            const hours = Math.floor(minutesValue / 60);
            const mins = minutesValue % 60;
            const hLab = hours === 1 ? hourSingular : hourPlural;
            const str = mins > 0 ? `${hours} ${hLab} ${mins} ${minutely(mins, language, t)}` : `${hours} ${hLab}`;
            return reportByDiffMinutes < 0 ? `-${str}` : `${inLabel} ${str}`;
        }
        return formatLabel(Math.round(minutesValue), minuteSingular, minutePlural);
    }, [reportByDiffMinutes, language, t]);

    // Assistance helper
    function minutely(val: number, lang: string, t: any) {
        if (lang === 'ml') return val === 1 ? 'മിനിറ്റ്' : 'മിനിറ്റുകൾ';
        return val === 1 ? 'minute' : 'minutes';
    }

    // 4. Wait estimations
    const confirmedEstimatedWaitMinutes = useMemo(() => {
        if (!yourAppointment || yourAppointment.status !== 'Confirmed') return 0;
        if (clinicData?.tokenDistribution === 'classic') {
            const confirmedQueue = doctorAppointmentsToday.filter(a => a.status === 'Confirmed');
            const pos = confirmedQueue.findIndex(a => a.id === yourAppointment.id);
            if (pos !== -1) {
                const ahead = pos;
                const avg = yourAppointmentDoctor?.averageConsultingTime || 15;
                let simTime = new Date(currentTime);
                const isDocIn = yourAppointmentDoctor?.consultationStatus === 'In';
                if (!isDocIn) {
                    if (breakMinutes > 0) simTime = addMinutes(simTime, breakMinutes);
                    else {
                        try {
                            const dayIndex = appointmentDate.getDay();
                            const slot = yourAppointmentDoctor?.availabilitySlots?.find(s => String(s.day) === String(dayIndex));
                            if (slot?.timeSlots[yourAppointment.sessionIndex || 0]) {
                                const start = parseTime(slot.timeSlots[yourAppointment.sessionIndex || 0].from, appointmentDate);
                                const wait = differenceInMinutes(start, currentTime);
                                if (wait > 0) simTime = addMinutes(simTime, wait);
                            }
                        } catch {}
                    }
                }
                let remaining = ahead * avg;
                try {
                    const brks = validBreaks.map(b => ({ start: parseISO(b.startTime), end: parseISO(b.endTime) })).sort((a,b) => a.start.getTime() - b.start.getTime());
                    for (const brk of brks.filter(b => isAfter(b.end, simTime))) {
                        if (remaining <= 0) break;
                        const isBrkActive = currentTime >= brk.start && currentTime < brk.end;
                        if (isDocIn && isBrkActive) continue;
                        let untilBrk = differenceInMinutes(brk.start, simTime);
                        if (untilBrk < 0) {
                            simTime = addMinutes(simTime, Math.max(0, differenceInMinutes(brk.end, simTime)));
                            continue;
                        }
                        if (remaining < untilBrk) {
                            simTime = addMinutes(simTime, remaining);
                            remaining = 0;
                        } else {
                            simTime = addMinutes(simTime, untilBrk);
                            remaining -= untilBrk;
                            simTime = addMinutes(simTime, differenceInMinutes(brk.end, brk.start));
                        }
                    }
                } catch {}
                if (remaining > 0) simTime = addMinutes(simTime, remaining);
                return Math.max(0, differenceInMinutes(simTime, currentTime));
            }
        }
        try {
            const est = arrivedEstimates.find(e => e.appointmentId === yourAppointment.id);
            if (est) return Math.max(0, differenceInMinutes(parseTime(est.estimatedTime, appointmentDate), currentTime));
            const apptTime = parseAppointmentDateTime(yourAppointment.date, yourAppointment.time);
            return Math.max(0, differenceInMinutes(apptTime, currentTime)); // Placeholder logic if no estimate
        } catch { return 0; }
    }, [yourAppointment, currentTime, clinicData, yourAppointmentDoctor, appointmentDate, breakMinutes, arrivedEstimates, validBreaks, doctorAppointmentsToday]);

    const estimatedWaitTime = useMemo(() => {
        if (!yourAppointment) return 0;
        if (yourAppointment.status === 'Confirmed') return confirmedEstimatedWaitMinutes;
        try {
            const time = parseAppointmentDateTime(yourAppointment.date, yourAppointment.time);
            return Math.max(0, differenceInMinutes(time, currentTime));
        } catch { return 0; }
    }, [yourAppointment, currentTime, confirmedEstimatedWaitMinutes]);

    const hoursUntilArrivalReminder = useMemo(() => {
        if (reportByDiffMinutes === null) return null;
        return Math.floor(Math.abs(reportByDiffMinutes) / 60);
    }, [reportByDiffMinutes]);

    const minutesUntilArrivalReminder = useMemo(() => {
        if (reportByDiffMinutes === null) return null;
        return Math.max(0, Math.floor(Math.abs(reportByDiffMinutes) % 60));
    }, [reportByDiffMinutes]);

    return {
        formattedDate,
        isAppointmentToday: isTodayAppointment,
        daysUntilAppointment,
        doctorStatusInfo,
        breakMinutes,
        reportByTimeDisplay,
        reportByDiffMinutes,
        isReportingPastDue,
        reportingCountdownLabel,
        estimatedWaitTime,
        confirmedEstimatedWaitMinutes,
        hoursUntilArrivalReminder,
        minutesUntilArrivalReminder
    };
}
