import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IActivityRepository, ITransaction } from '../domain/repositories';
import {
    parseClinicDate,
    getClinicDayOfWeek,
    parseClinicTime,
    addMinutes,
    getClinicTimeString,
    differenceInMinutes
} from '../domain/services/DateUtils';
import { KloqoRole, KLOQO_ROLES } from '../../../packages/shared/src/index';
import { subMinutes } from 'date-fns';

export interface CancelBreakRequest {
    clinicId: string;
    doctorId: string;
    breakId: string;
    date: string;
    shouldOpenSlots: boolean;
    shouldPullForward?: boolean;
    performedBy: { id: string; name: string; role: KloqoRole };
}

export interface CancelBreakResult {
    ghostsRemoved: number;
    appointmentsPulledBack: number;
}

const PULL_BACK_MINIMUM_MINUTES = 1;

/**
 * CancelBreakUseCase
 * 
 * CLEAN ARCHITECTURE: This use case is infrastructure-agnostic.
 * It handles the atomic reversal of a break and its ripple effects.
 */
export class CancelBreakUseCase {
    constructor(
        private appointmentRepo: IAppointmentRepository,
        private doctorRepo: IDoctorRepository,
        private clinicRepo: IClinicRepository,
        private activityRepo: IActivityRepository
    ) {}

    async execute(request: CancelBreakRequest): Promise<CancelBreakResult> {
        const { clinicId, doctorId, breakId, date, shouldOpenSlots, shouldPullForward = false, performedBy } = request;

        const doctor = await this.doctorRepo.findById(doctorId, clinicId);
        if (!doctor) throw new Error('Doctor not found');
        if (doctor.clinicId !== clinicId) throw new Error('Unauthorized');

        const isSelfInitiated = performedBy.id === doctor.id || performedBy.id === doctor.userId;
        const isManagement = ([KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN] as KloqoRole[]).includes(performedBy.role);
        const isClinicalStaff = ([KLOQO_ROLES.NURSE, KLOQO_ROLES.RECEPTIONIST] as KloqoRole[]).includes(performedBy.role);

        if (!isSelfInitiated && !isManagement && !isClinicalStaff) throw new Error('Unauthorized');

        const breakPeriods = doctor.breakPeriods || {};
        const dateBreaks = breakPeriods[date] || [];
        const breakToRemove = dateBreaks.find((b: any) => b.id === breakId);
        if (!breakToRemove) throw new Error('Break not found');

        const sessionIndex = breakToRemove.sessionIndex;
        const baseDate = parseClinicDate(date);
        const breakStart = parseClinicTime(breakToRemove.startTimeFormatted, baseDate);
        const breakEnd = parseClinicTime(breakToRemove.endTimeFormatted, baseDate);
        const breakDuration = differenceInMinutes(breakEnd, breakStart);

        const updatedBreaks = dateBreaks.filter((b: any) => b.id !== breakId);
        breakPeriods[date] = updatedBreaks;

        const allAppointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, date);
        const ghostsInBreak = allAppointments.filter(a => a.isSystemBlocker && a.sessionIndex === sessionIndex && parseClinicTime(a.time, baseDate) >= breakStart && parseClinicTime(a.time, baseDate) < breakEnd);

        let ghostsRemoved = 0;
        let appointmentsPulledBack = 0;

        // ATOMIC TRANSACTION
        await this.appointmentRepo.runTransaction(async (txn: ITransaction) => {
            // 1. Remove Ghosts
            for (const ghost of ghostsInBreak) {
                await this.appointmentRepo.delete(ghost.id, clinicId, txn);
                ghostsRemoved++;
            }

            // 2. Open Slots
            if (shouldOpenSlots) {
                const residualBlockers = allAppointments.filter(a => a.sessionIndex === sessionIndex && a.cancelledByBreak === true && !a.isSystemBlocker);
                for (const appt of residualBlockers) {
                    const t = parseClinicTime(appt.time, baseDate);
                    if (t >= breakStart && t < breakEnd) {
                        await this.appointmentRepo.update(appt.id, appt.clinicId, { cancelledByBreak: false, status: 'Pending' }, txn);
                    }
                }
            }

            // 3. Pull Forward
            if (shouldPullForward && breakDuration > 0) {
                const postBreakAppointments = allAppointments.filter(a => a.sessionIndex === sessionIndex && a.status !== 'Cancelled' && !a.isSystemBlocker && parseClinicTime(a.time, baseDate) >= breakEnd).sort((a, b) => parseClinicTime(a.time, baseDate).getTime() - parseClinicTime(b.time, baseDate).getTime());
                for (const appt of postBreakAppointments) {
                    const curTime = parseClinicTime(appt.time, baseDate);
                    const pulledTime = addMinutes(curTime, -breakDuration);
                    if (differenceInMinutes(curTime, pulledTime) >= PULL_BACK_MINIMUM_MINUTES) {
                        await this.appointmentRepo.update(appt.id, appt.clinicId, { time: getClinicTimeString(pulledTime), arriveByTime: getClinicTimeString(subMinutes(pulledTime, 15)) }, txn);
                        appointmentsPulledBack++;
                    }
                }
            }

            // 4. Recalculate Extensions
            const availabilityExtensions = doctor.availabilityExtensions || {};
            const dateExtensions = availabilityExtensions[date] || { sessions: [] };
            const sessionExtIdx = dateExtensions.sessions.findIndex((s: any) => s.sessionIndex === sessionIndex);
            
            if (sessionExtIdx >= 0) {
                const remainingShift = updatedBreaks.filter((b: any) => b.sessionIndex === sessionIndex).reduce((sum: number, b: any) => sum + (b.actualShiftMinutes ?? b.duration ?? 0), 0);
                if (remainingShift === 0) {
                    dateExtensions.sessions.splice(sessionExtIdx, 1);
                } else {
                    const sessionExt = dateExtensions.sessions[sessionExtIdx];
                    sessionExt.totalExtendedBy = remainingShift;
                    const dayOfWeek = getClinicDayOfWeek(baseDate);
                    const availability = doctor.availabilitySlots.find(s => s.day === dayOfWeek);
                    if (availability?.timeSlots[sessionIndex]) {
                        const originalEnd = parseClinicTime(availability.timeSlots[sessionIndex].to, baseDate);
                        sessionExt.newEndTime = getClinicTimeString(addMinutes(originalEnd, remainingShift));
                    }
                }
            }
            if (dateExtensions.sessions.length === 0) delete availabilityExtensions[date];
            else availabilityExtensions[date] = dateExtensions;

            // 5. Update Doctor
            await this.doctorRepo.update(doctorId, clinicId, { breakPeriods, availabilityExtensions }, txn);
            await this.doctorRepo.saveBreaks(doctorId, clinicId, date, updatedBreaks, txn);
        });

        this.doctorRepo.invalidateCache(doctorId, clinicId);

        await this.activityRepo.save({
            id: '', type: 'SCHEDULING_CHANGE', action: 'CANCEL_BREAK', doctorId, clinicId, performedBy,
            details: { date, breakId, startTime: breakToRemove.startTimeFormatted, endTime: breakToRemove.endTimeFormatted, breakDuration, ghostsRemoved, shouldOpenSlots, shouldPullForward, appointmentsPulledBack },
            timestamp: new Date(), expiresAt: null
        });

        return { ghostsRemoved, appointmentsPulledBack };
    }
}
