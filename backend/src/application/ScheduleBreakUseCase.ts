import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IActivityRepository, ITransaction } from '../domain/repositories';
import {
    parseClinicDate,
    getClinicDayOfWeek,
    parseClinicTime,
    addMinutes,
    getClinicTimeString,
    getClinicISODateString
} from '../domain/services/DateUtils';
import { BreakPeriod, KloqoRole, KLOQO_ROLES } from '../../../packages/shared/src/index';
import { subMinutes } from 'date-fns';

export type BreakCompensationMode = 'GAP_ABSORPTION' | 'FULL_COMPENSATION';

export interface ScheduleBreakRequest {
    clinicId: string;
    doctorId: string;
    date: string;
    startTime: string;
    endTime: string;
    sessionIndex: number;
    reason?: string;
    compensationMode?: BreakCompensationMode;
    performedBy: { id: string; name: string; role: KloqoRole };
    isDryRun?: boolean;
}

export interface ScheduleBreakResult {
    breakPeriod: BreakPeriod;
    shiftedCount: number;
    ghostsCreated: number;
    delayMinutes: number;
    preview: Array<{ tokenNumber: string; oldTime: string; newTime: string; deltaMinutes: number }>;
}

const NOTIFICATION_THRESHOLD_MINUTES = 15;

/**
 * ScheduleBreakUseCase
 * 
 * CLEAN ARCHITECTURE: This use case is infrastructure-agnostic.
 * It manages break scheduling and ensures queue integrity through "ghost" slots.
 */
export class ScheduleBreakUseCase {
    constructor(
        private appointmentRepo: IAppointmentRepository,
        private doctorRepo: IDoctorRepository,
        private clinicRepo: IClinicRepository,
        private activityRepo: IActivityRepository
    ) {}

    async execute(request: ScheduleBreakRequest): Promise<ScheduleBreakResult> {
        const { 
            clinicId, doctorId, date, startTime, endTime, 
            sessionIndex, reason, compensationMode = 'GAP_ABSORPTION',
            performedBy, isDryRun = false
        } = request;

        const doctor = await this.doctorRepo.findById(doctorId, clinicId);
        if (!doctor) throw new Error('Doctor not found');
        if (doctor.clinicId !== clinicId) throw new Error('Unauthorized');

        const isSelfInitiated = performedBy.id === doctor.id || performedBy.id === doctor.userId;
        const isManagement = ([KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN] as KloqoRole[]).includes(performedBy.role);
        const isClinicalStaff = ([KLOQO_ROLES.NURSE, KLOQO_ROLES.RECEPTIONIST] as KloqoRole[]).includes(performedBy.role);

        if (!isSelfInitiated && !isManagement && !isClinicalStaff) throw new Error('Unauthorized');

        const baseDate = parseClinicDate(date);
        const breakStart = parseClinicTime(startTime, baseDate);
        const breakEnd = parseClinicTime(endTime, baseDate);
        if (breakEnd <= breakStart) throw new Error('Invalid times');

        const breakDurationMinutes = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
        const allAppointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, date);
        allAppointments.sort((a, b) => parseClinicTime(a.time, baseDate).getTime() - parseClinicTime(b.time, baseDate).getTime());

        const existingBreaks = (doctor.breakPeriods?.[date] || []).filter((b: any) => b.sessionIndex === sessionIndex);
        for (const existing of existingBreaks) {
            const exStart = parseClinicTime(existing.startTimeFormatted, baseDate);
            const exEnd = parseClinicTime(existing.endTimeFormatted, baseDate);
            if (breakStart < exEnd && breakEnd > exStart) throw new Error('Overlapping break');
        }

        const dateKey = getClinicISODateString(baseDate);
        const override = doctor.dateOverrides?.[dateKey];
        let sessionSlot: { from: string; to: string };

        if (override) {
            if (override.isOff) throw new Error('Doctor off');
            if (!override.slots || !override.slots[sessionIndex]) throw new Error('Invalid session');
            sessionSlot = override.slots[sessionIndex];
        } else {
            const dayOfWeekLabel = getClinicDayOfWeek(baseDate);
            const availability = doctor.availabilitySlots.find(s => s.day === dayOfWeekLabel);
            if (!availability || !availability.timeSlots[sessionIndex]) throw new Error('Invalid session');
            sessionSlot = availability.timeSlots[sessionIndex];
        }

        const sessionEnd = parseClinicTime(sessionSlot.to, baseDate);
        if (breakEnd > sessionEnd) throw new Error('Beyond session end');

        const slotDuration = doctor.averageConsultingTime || 15;
        const appointmentsInBreak = allAppointments.filter(a => {
            if (a.sessionIndex !== sessionIndex || a.status === 'Cancelled' || a.isSystemBlocker) return false;
            const t = parseClinicTime(a.time, baseDate);
            return t >= breakStart && t < breakEnd;
        });

        const actualShiftMinutes = compensationMode === 'FULL_COMPENSATION' 
            ? breakDurationMinutes 
            : appointmentsInBreak.length * slotDuration;

        const postBreakAppointments = allAppointments.filter(a => {
            if (a.sessionIndex !== sessionIndex || a.status === 'Cancelled' || a.isSystemBlocker) return false;
            return parseClinicTime(a.time, baseDate) >= breakEnd;
        });

        const preview: ScheduleBreakResult['preview'] = [];
        const shiftedAppointmentIds: string[] = [];

        // PREPARE RESULTS
        for (const [idx, appt] of appointmentsInBreak.entries()) {
            const oldTime = parseClinicTime(appt.time, baseDate);
            const newTime = addMinutes(breakEnd, idx * slotDuration);
            const delta = Math.round((newTime.getTime() - oldTime.getTime()) / 60000);
            if (delta >= NOTIFICATION_THRESHOLD_MINUTES) {
                preview.push({ tokenNumber: appt.tokenNumber, oldTime: getClinicTimeString(oldTime), newTime: getClinicTimeString(newTime), deltaMinutes: delta });
            }
        }

        for (const appt of postBreakAppointments) {
            if (actualShiftMinutes > 0) {
                const oldTime = parseClinicTime(appt.time, baseDate);
                const newTime = addMinutes(oldTime, actualShiftMinutes);
                if (actualShiftMinutes >= NOTIFICATION_THRESHOLD_MINUTES) {
                    preview.push({ tokenNumber: appt.tokenNumber, oldTime: getClinicTimeString(oldTime), newTime: getClinicTimeString(newTime), deltaMinutes: actualShiftMinutes });
                }
            }
        }

        const breakPeriod: BreakPeriod = {
            id: `break-${Date.now()}`,
            startTime: breakStart.toISOString(),
            endTime: breakEnd.toISOString(),
            startTimeFormatted: startTime,
            endTimeFormatted: endTime,
            duration: breakDurationMinutes,
            actualShiftMinutes,
            sessionIndex,
            slots: [],
            type: 'BREAK',
            createdAt: new Date().toISOString()
        };

        const breakPeriods = doctor.breakPeriods || {};
        const dateBreaks = breakPeriods[date] || [];
        dateBreaks.push(breakPeriod);
        breakPeriods[date] = dateBreaks;

        const availabilityExtensions = doctor.availabilityExtensions || {};
        const dateExtensions = availabilityExtensions[date] || { sessions: [] };
        const sessionExtIdx = dateExtensions.sessions.findIndex((s: any) => s.sessionIndex === sessionIndex);
        if (sessionExtIdx >= 0) {
            dateExtensions.sessions[sessionExtIdx].totalExtendedBy += actualShiftMinutes;
            const curEnd = parseClinicTime(dateExtensions.sessions[sessionExtIdx].newEndTime, baseDate);
            dateExtensions.sessions[sessionExtIdx].newEndTime = getClinicTimeString(addMinutes(curEnd, actualShiftMinutes));
        } else {
            const originalEnd = parseClinicTime(sessionSlot.to, baseDate);
            dateExtensions.sessions.push({ sessionIndex, totalExtendedBy: actualShiftMinutes, newEndTime: getClinicTimeString(addMinutes(originalEnd, actualShiftMinutes)) });
        }
        availabilityExtensions[date] = dateExtensions;

        let ghostsCreated = 0;
        if (!isDryRun) {
            await this.appointmentRepo.runTransaction(async (txn: ITransaction) => {
                // 1. Shift appointments in break
                for (const [idx, appt] of appointmentsInBreak.entries()) {
                    const newTime = addMinutes(breakEnd, idx * slotDuration);
                    await this.appointmentRepo.update(appt.id, appt.clinicId, {
                        time: getClinicTimeString(newTime),
                        arriveByTime: getClinicTimeString(subMinutes(newTime, 15)),
                        cancelledByBreak: false
                    }, txn);
                }

                // 2. Shift post-break appointments
                if (actualShiftMinutes > 0) {
                    for (const appt of postBreakAppointments) {
                        const newTime = addMinutes(parseClinicTime(appt.time, baseDate), actualShiftMinutes);
                        await this.appointmentRepo.update(appt.id, appt.clinicId, {
                            time: getClinicTimeString(newTime),
                            arriveByTime: getClinicTimeString(subMinutes(newTime, 15))
                        }, txn);
                    }
                }

                // 3. Create Ghost Slots
                const alreadyOccupied = new Set(appointmentsInBreak.map(a => a.time));
                const totalSlots = Math.ceil(breakDurationMinutes / slotDuration);
                for (let i = 0; i < totalSlots; i++) {
                    const slotTime = getClinicTimeString(addMinutes(breakStart, i * slotDuration));
                    if (alreadyOccupied.has(slotTime)) continue;

                    const ghostId = `ghost-break-${doctorId}-${date}-${slotTime.replace(':', '')}-${sessionIndex}`;
                    await this.appointmentRepo.save({
                        id: ghostId, patientId: 'system-break-blocker', patientName: 'kloqo break block',
                        doctorId, doctorName: doctor.name, clinicId, date, time: slotTime,
                        arriveByTime: slotTime, sessionIndex, status: 'Completed', bookedVia: 'BreakBlock',
                        tokenNumber: 'Break', numericToken: 0, cancelledByBreak: true, isSystemBlocker: true,
                        createdAt: new Date(), updatedAt: new Date()
                    } as any, txn);
                    ghostsCreated++;
                }

                // 4. Update Doctor
                await this.doctorRepo.update(doctorId, clinicId, { breakPeriods, availabilityExtensions }, txn);
                await this.doctorRepo.saveBreaks(doctorId, clinicId, date, dateBreaks, txn);
            });

            this.doctorRepo.invalidateCache(doctorId, clinicId);
            await this.activityRepo.save({
                id: '', type: 'SCHEDULING_CHANGE', action: 'SCHEDULE_BREAK', doctorId, clinicId, performedBy,
                details: { date, startTime, endTime, sessionIndex, reason: reason || null, breakDuration: breakDurationMinutes, actualShiftApplied: actualShiftMinutes, occupiedSlotsInBreak: appointmentsInBreak.length, shiftedCount: preview.length, ghostsCreated, notifiableCount: preview.length },
                timestamp: new Date(), expiresAt: null
            });
        } else {
            const alreadyOccupied = new Set(appointmentsInBreak.map(a => a.time));
            ghostsCreated = Math.ceil(breakDurationMinutes / slotDuration) - alreadyOccupied.size;
        }

        return { breakPeriod, shiftedCount: appointmentsInBreak.length + postBreakAppointments.length, ghostsCreated, delayMinutes: actualShiftMinutes, preview };
    }
}
