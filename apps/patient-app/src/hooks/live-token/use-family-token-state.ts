'use client';

import { useMemo, useCallback } from 'react';
import { isToday, parse, isPast, differenceInHours, addMinutes } from 'date-fns';
import { parseAppointmentDateTime, parseTime } from '@/lib/utils';
import type { Appointment } from '@kloqo/shared';

export function useFamilyTokenState(familyAppointments: Appointment[], appointmentId?: string) {
    
    const getNoShowTimestamp = useCallback((appointment: Appointment): Date | null => {
        if (appointment.status !== 'No-show') return null;
        try {
            if (appointment.noShowTime) {
                let noShowDate: Date;
                if (appointment.noShowTime instanceof Date && !isNaN(appointment.noShowTime.getTime())) {
                    noShowDate = appointment.noShowTime;
                } else if (typeof (appointment.noShowTime as any)?.toDate === 'function') {
                    noShowDate = (appointment.noShowTime as any).toDate();
                } else if (typeof appointment.noShowTime === 'string') {
                    noShowDate = new Date(appointment.noShowTime);
                } else if (typeof appointment.noShowTime === 'number') {
                    noShowDate = new Date(appointment.noShowTime);
                } else {
                    const appointmentDateTime = parseAppointmentDateTime(appointment.date, appointment.time);
                    noShowDate = addMinutes(appointmentDateTime, 15);
                }
                if (noShowDate instanceof Date && !isNaN(noShowDate.getTime())) return noShowDate;
            }
            const appointmentDateTime = parseAppointmentDateTime(appointment.date, appointment.time);
            return addMinutes(appointmentDateTime, 15);
        } catch { return null; }
    }, []);

    const familyUpcomingAppointments = useMemo(() => {
        if (familyAppointments.length === 0) return [];
        const upcoming = familyAppointments.filter(a => {
            if (a.status === 'Cancelled' || a.status === 'Completed') return false;
            let appointmentDate;
            try { appointmentDate = parse(a.date, "d MMMM yyyy", new Date()); } 
            catch { appointmentDate = new Date(a.date); }
            return isToday(appointmentDate) || !isPast(appointmentDate);
        });
        
        upcoming.sort((a, b) => {
            try {
                const dateA = parse(a.date, "d MMMM yyyy", new Date());
                const dateB = parse(b.date, "d MMMM yyyy", new Date());
                const dateDiff = dateA.getTime() - dateB.getTime();
                if (dateDiff !== 0) return dateDiff;
                const timeA = parseTime(a.time, dateA).getTime();
                const timeB = parseTime(b.time, dateB).getTime();
                if (timeA !== timeB) return timeA - timeB;
                if (a.tokenNumber?.startsWith('A') && b.tokenNumber?.startsWith('W')) return -1;
                if (a.tokenNumber?.startsWith('W') && b.tokenNumber?.startsWith('A')) return 1;
                const tokenNumA = parseInt(a.tokenNumber?.replace(/[A-W]/g, '') || '0', 10);
                const tokenNumB = parseInt(b.tokenNumber?.replace(/[A-W]/g, '') || '0', 10);
                return tokenNumA - tokenNumB;
            } catch { return 0; }
        });
        return upcoming;
    }, [familyAppointments]);

    const visibleFamilyAppointments = useMemo(() => {
        const now = new Date();
        return familyUpcomingAppointments.filter(appt => {
            if (appt.status === 'Cancelled' || appt.status === 'Completed') return false;
            if (appt.status === 'No-show') {
                const noShowTime = getNoShowTimestamp(appt);
                if (!noShowTime) return false;
                const hoursSinceNoShow = differenceInHours(now, noShowTime);
                return hoursSinceNoShow >= 0 && hoursSinceNoShow <= 2;
            }
            return true;
        });
    }, [familyUpcomingAppointments, getNoShowTimestamp]);

    const uniquePatientAppointments = useMemo(() => {
        const patientMap = new Map<string, Appointment>();
        visibleFamilyAppointments.forEach(appt => {
            if (!appt.patientId) return;
            if (!patientMap.has(appt.patientId)) patientMap.set(appt.patientId, appt);
        });
        return Array.from(patientMap.values());
    }, [visibleFamilyAppointments]);

    const activeAppointmentBase = useMemo(() => {
        if (visibleFamilyAppointments.length === 0) return null;
        if (appointmentId) {
            return visibleFamilyAppointments.find(a => a.id === appointmentId) || visibleFamilyAppointments[0];
        }
        return visibleFamilyAppointments[0];
    }, [visibleFamilyAppointments, appointmentId]);

    return {
        activeAppointmentBase,
        uniquePatientAppointments,
        visibleFamilyAppointments,
        getNoShowTimestamp
    };
}
