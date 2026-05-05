// ╔══════════════════════════════════════════════════════════════════════════╗
// ║                    ⚠️  AI GUARD — DO NOT EDIT                           ║
// ║                                                                          ║
// ║  This file contains the Edit Break Use Case.                             ║
// ║  It handles manual shift logic for existing appointments.                ║
// ║                                                                          ║
// ║  🚫 AI models MUST NOT modify this file without explicit written         ║
// ║     permission from the project owner (Jino Devasia).                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IActivityRepository, ITransaction } from '../domain/repositories';
import { 
    parseClinicDate,
    getClinicDayOfWeek,
    parseClinicTime,
    addMinutes,
    getClinicTimeString
} from '../domain/services/DateUtils';
import { BreakPeriod, KloqoRole, KLOQO_ROLES } from '../../../packages/shared/src/index';
import { subMinutes } from 'date-fns';
import { NotificationService } from '../domain/services/NotificationService';

export interface EditBreakRequest {
    clinicId: string;
    doctorId: string;
    breakId: string;
    date: string;
    startTime: string;
    endTime: string;
    performedBy: { id: string; name: string; role: KloqoRole };
}

/**
 * EditBreakUseCase
 * 
 * CLEAN ARCHITECTURE: This use case is infrastructure-agnostic.
 * It handles the ripple effects of editing a break on existing appointments.
 */
export class EditBreakUseCase {
    constructor(
        private appointmentRepo: IAppointmentRepository,
        private doctorRepo: IDoctorRepository,
        private clinicRepo: IClinicRepository,
        private activityRepo: IActivityRepository,
        private notificationService?: NotificationService
    ) {}

    async execute(request: EditBreakRequest): Promise<void> {
        const { clinicId, doctorId, breakId, date, startTime, endTime, performedBy } = request;

        const doctor = await this.doctorRepo.findById(doctorId, clinicId);
        if (!doctor) throw new Error('Doctor not found');

        // RBAC
        const isSelfInitiated = performedBy.id === doctor.id || performedBy.id === doctor.userId;
        const isAdmin = ([KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN] as KloqoRole[]).includes(performedBy.role);
        const isNurse = (performedBy.role as KloqoRole) === KLOQO_ROLES.NURSE;
        if (!isAdmin && !isNurse && !isSelfInitiated) throw new Error('Unauthorized');

        const breakPeriods = doctor.breakPeriods || {};
        const dateBreaks = breakPeriods[date] || [];
        const oldBreak = dateBreaks.find((b: any) => b.id === breakId);
        if (!oldBreak) throw new Error('Break not found');

        const baseDate = parseClinicDate(date);
        const newBreakStart = parseClinicTime(startTime, baseDate);
        const newBreakEnd = parseClinicTime(endTime, baseDate);
        const oldBreakStart = new Date(oldBreak.startTime);
        const oldDuration = oldBreak.duration;
        const newDuration = (newBreakEnd.getTime() - newBreakStart.getTime()) / (1000 * 60);

        if (newBreakEnd <= newBreakStart) throw new Error('End time must be after start time');

        const allAppointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, date);
        const sessionAppointments = allAppointments.filter(a => a.sessionIndex === oldBreak.sessionIndex && a.status !== 'Cancelled');

        // PREPARE UPDATES
        const updatedBreak: BreakPeriod = {
            ...oldBreak,
            startTime: newBreakStart.toISOString(),
            endTime: newBreakEnd.toISOString(),
            startTimeFormatted: startTime,
            endTimeFormatted: endTime,
            duration: newDuration,
        };

        const updatedBreaks = dateBreaks.map(b => b.id === breakId ? updatedBreak : b);
        breakPeriods[date] = updatedBreaks;

        const availabilityExtensions = doctor.availabilityExtensions || {};
        const dateExtensions = availabilityExtensions[date] || { sessions: [] };
        const sessionExtIndex = dateExtensions.sessions.findIndex((s: any) => s.sessionIndex === oldBreak.sessionIndex);
        
        if (sessionExtIndex >= 0) {
            const ext = dateExtensions.sessions[sessionExtIndex];
            const driftDelta = newDuration - oldDuration;
            ext.totalExtendedBy += driftDelta;
            const currentEndTime = parseClinicTime(ext.newEndTime, baseDate);
            ext.newEndTime = getClinicTimeString(addMinutes(currentEndTime, driftDelta));
        }

        // ATOMIC TRANSACTION
        await this.appointmentRepo.runTransaction(async (txn: ITransaction) => {
            // 1. Shift Appointments
            for (const appt of sessionAppointments) {
                let apptTime = parseClinicTime(appt.arriveByTime || appt.time, baseDate);
                if (apptTime >= oldBreakStart) apptTime = addMinutes(apptTime, -oldDuration);
                if (apptTime >= newBreakStart) apptTime = addMinutes(apptTime, newDuration);

                await this.appointmentRepo.update(appt.id, appt.clinicId, {
                    time: getClinicTimeString(apptTime),
                    arriveByTime: getClinicTimeString(subMinutes(apptTime, 15)),
                    cancelledByBreak: apptTime >= newBreakStart && apptTime < newBreakEnd
                }, txn);
            }

            // 2. Update Doctor
            await this.doctorRepo.update(doctorId, clinicId, {
                breakPeriods,
                availabilityExtensions
            }, txn);

            // 3. Update Breaks Subcollection
            await this.doctorRepo.saveBreaks(doctorId, clinicId, date, updatedBreaks, txn);
        });

        this.doctorRepo.invalidateCache(doctorId, clinicId);

        await this.activityRepo.save({
            id: '',
            type: 'SCHEDULING_CHANGE',
            action: 'EDIT_BREAK',
            doctorId,
            clinicId,
            performedBy,
            details: { date, breakId, oldDuration, newDuration, startTime, endTime },
            timestamp: new Date(),
            expiresAt: null
        });

        // NOTIFY: Break updated (Broadcast)
        if (this.notificationService) {
            this.notificationService.notifyAllPatientsOfBreak({
                clinicId, doctorId, date, durationMinutes: newDuration
            }).catch(err => console.error('[EditBreak] Notify failed:', err));
        }
    }
}
