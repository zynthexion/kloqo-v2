import { format, subMinutes } from 'date-fns';
import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IActivityRepository } from '../domain/repositories';
import {
    parseClinicDate,
    getClinicDayOfWeek,
    parseClinicTime,
    addMinutes,
    getClinicTimeString,
    differenceInMinutes
} from '../domain/services/DateUtils';
import { Role } from '../../../packages/shared/src/index';

export interface CancelBreakRequest {
    clinicId: string;
    doctorId: string;
    breakId: string;
    date: string; // "19 March 2026"
    /**
     * If true, clean the ghost blockers and open slots for walk-ins (leave a dead gap).
     * This is the safe default. Subsequent patient appointments remain at their shifted times.
     */
    shouldOpenSlots: boolean;
    /**
     * OPT-IN ONLY — Pull shifted appointments backward to fill the break gap.
     * WARNING: Patients may have already left the clinic or planned around their new time.
     * Only enable this via an explicit UI toggle with a "patients may miss their slot" warning.
     * Defaults to false.
     */
    shouldPullForward?: boolean;
    performedBy: { id: string; name: string; role: Role };
}

export interface CancelBreakResult {
    ghostsRemoved: number;
    appointmentsPulledBack: number; // 0 if shouldPullForward was false
}

/** Only pull back appointments that would benefit by more than this threshold */
const PULL_BACK_MINIMUM_MINUTES = 1;

export class CancelBreakUseCase {
    constructor(
        private appointmentRepo: IAppointmentRepository,
        private doctorRepo: IDoctorRepository,
        private clinicRepo: IClinicRepository,
        private activityRepo: IActivityRepository
    ) {}

    async execute(request: CancelBreakRequest): Promise<CancelBreakResult> {
        const { clinicId, doctorId, breakId, date, shouldOpenSlots, shouldPullForward = false, performedBy } = request;

        // ── 1. LOAD & AUTHORIZE ──────────────────────────────────────────────
        const doctor = await this.doctorRepo.findById(doctorId);
        if (!doctor) throw new Error('Doctor not found');

        // CLINIC SCOPING GUARD
        if (doctor.clinicId !== clinicId) {
            throw new Error('Unauthorized: Doctor does not belong to this clinic.');
        }

        // RBAC: Self, Admins, or Clinical Staff (Nurses/Receptionists)
        const isSelfInitiated = performedBy.id === doctor.id || performedBy.id === doctor.userId;
        const isManagement   = ['clinicAdmin', 'superAdmin'].includes(performedBy.role);
        const isClinicalStaff = ['nurse', 'receptionist'].includes(performedBy.role);

        if (!isSelfInitiated && !isManagement && !isClinicalStaff) {
            throw new Error('Unauthorized: You do not have permission to manage this doctor\'s schedule.');
        }

        // ── 2. FIND THE BREAK TO REMOVE ─────────────────────────────────────
        const breakPeriods = doctor.breakPeriods || {};
        const dateBreaks   = breakPeriods[date] || [];
        const breakToRemove = dateBreaks.find((b: any) => b.id === breakId);
        if (!breakToRemove) throw new Error('Break not found');

        const sessionIndex = breakToRemove.sessionIndex;
        const breakStart   = parseClinicTime(breakToRemove.startTimeFormatted, parseClinicDate(date));
        const breakEnd     = parseClinicTime(breakToRemove.endTimeFormatted,   parseClinicDate(date));
        const breakDuration = differenceInMinutes(breakEnd, breakStart);

        // ── 3. REMOVE BREAK FROM DOCTOR DOCUMENT ────────────────────────────
        const updatedBreaks = dateBreaks.filter((b: any) => b.id !== breakId);
        breakPeriods[date]  = updatedBreaks;

        // ── 4. GHOST CLEANUP — delete all system blocker records for this break ──
        //
        // Ghost records have: isSystemBlocker === true, sessionIndex === sessionIndex,
        // and their time falls within [breakStart, breakEnd).
        //
        const allAppointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, date);
        const baseDate = parseClinicDate(date);

        const ghostsInBreak = allAppointments.filter(a => {
            if (!a.isSystemBlocker) return false;
            if (a.sessionIndex !== sessionIndex) return false;
            const t = parseClinicTime(a.arriveByTime || a.time, baseDate);
            return t >= breakStart && t < breakEnd;
        });

        let ghostsRemoved = 0;
        for (const ghost of ghostsInBreak) {
            await this.appointmentRepo.delete(ghost.id);
            ghostsRemoved++;
        }

        // ── 5. OPEN SLOTS (shouldOpenSlots) ──────────────────────────────────
        //
        // This just ensures any appointment that was marked cancelledByBreak = true
        // during the break window gets cleaned up. Normally there shouldn't be any
        // (since Ghost Generation handles empty slots), but this is a safety net.
        //
        if (shouldOpenSlots) {
            const residualBlockers = allAppointments.filter(a =>
                a.sessionIndex === sessionIndex &&
                a.cancelledByBreak === true &&
                !a.isSystemBlocker // real patient appointments that were flagged
            );

            for (const appt of residualBlockers) {
                const t = parseClinicTime(appt.arriveByTime || appt.time, baseDate);
                if (t >= breakStart && t < breakEnd) {
                    await this.appointmentRepo.update(appt.id, {
                        cancelledByBreak: false,
                        status: 'Pending',
                        updatedAt: new Date()
                    });
                }
            }
        }

        // ── 6. OPT-IN PULL FORWARD (shouldPullForward) ──────────────────────
        //
        // CONTRACT: This is a MANUAL opt-in only, gated by an explicit UI toggle.
        // The UI MUST show: "Patients may have already left the clinic or planned
        // around their new times. Pulling forward may cause missed slots."
        //
        // BULKHEAD: Only pull back appointment in this sessionIndex.
        //
        let appointmentsPulledBack = 0;

        if (shouldPullForward && breakDuration > 0) {
            // Find all real (non-ghost) post-break appointments in this session
            const postBreakAppointments = allAppointments
                .filter(a => {
                    if (a.sessionIndex !== sessionIndex) return false;
                    if (a.status === 'Cancelled' || a.isSystemBlocker) return false;
                    const t = parseClinicTime(a.arriveByTime || a.time, baseDate);
                    return t >= breakEnd; // strictly after the original break end
                })
                .sort((a, b) => {
                    const tA = parseClinicTime(a.arriveByTime || a.time, baseDate).getTime();
                    const tB = parseClinicTime(b.arriveByTime || b.time, baseDate).getTime();
                    return tA - tB;
                });

            for (const appt of postBreakAppointments) {
                const currentTime = parseClinicTime(appt.arriveByTime || appt.time, baseDate);
                const pulledTime  = addMinutes(currentTime, -breakDuration); // shift backward

                if (differenceInMinutes(currentTime, pulledTime) < PULL_BACK_MINIMUM_MINUTES) continue;

                await this.appointmentRepo.update(appt.id, {
                    time:         format(pulledTime, 'HH:mm'),
                    arriveByTime: format(subMinutes(pulledTime, 15), 'HH:mm'),
                    updatedAt:    new Date()
                });
                appointmentsPulledBack++;
            }
        }

        // ── 7. RECALCULATE SESSION EXTENSION ────────────────────────────────
        //
        // Now that the break is removed, reduce the session extension accordingly.
        // We use the stored durations of remaining breaks (not breakDuration of removed one).
        //
        const availabilityExtensions = doctor.availabilityExtensions || {};
        const dateExtensions         = availabilityExtensions[date]   || { sessions: [] };

        const sessionExtIndex = dateExtensions.sessions.findIndex((s: any) => s.sessionIndex === sessionIndex);
        if (sessionExtIndex >= 0) {
            const remainingSessionBreaks = updatedBreaks.filter((b: any) => b.sessionIndex === sessionIndex);
            const totalRemainingShift = remainingSessionBreaks.reduce(
                (sum: number, b: any) => sum + (b.actualShiftMinutes ?? b.duration ?? 0), 0
            );

            if (totalRemainingShift === 0) {
                // No more breaks for this session — remove the extension entry entirely
                dateExtensions.sessions.splice(sessionExtIndex, 1);
            } else {
                const sessionExt    = dateExtensions.sessions[sessionExtIndex];
                sessionExt.totalExtendedBy = totalRemainingShift;

                const dayOfWeek    = getClinicDayOfWeek(baseDate);
                const availability = doctor.availabilitySlots.find(s => s.day === dayOfWeek);
                if (availability?.timeSlots[sessionIndex]) {
                    const originalEndNum = parseClinicTime(availability.timeSlots[sessionIndex].to, baseDate);
                    sessionExt.newEndTime = getClinicTimeString(addMinutes(originalEndNum, totalRemainingShift));
                }
            }
        }

        if (dateExtensions.sessions.length === 0) {
            delete availabilityExtensions[date];
        } else {
            availabilityExtensions[date] = dateExtensions;
        }

        // ── 8. PERSIST DOCTOR DOCUMENT CHANGES ──────────────────────────────
        await this.doctorRepo.update(doctorId, {
            breakPeriods,
            availabilityExtensions,
            updatedAt: new Date()
        });

        // ── 9. AUDIT LOG ──────────────────────────────────────────────────────
        await this.activityRepo.save({
            id:          '',
            type:        'SCHEDULING_CHANGE',
            action:      'CANCEL_BREAK',
            doctorId,
            clinicId,
            performedBy,
            details: {
                date,
                breakId,
                startTime:             breakToRemove.startTimeFormatted,
                endTime:               breakToRemove.endTimeFormatted,
                breakDuration,
                ghostsRemoved,
                shouldOpenSlots,
                shouldPullForward,
                appointmentsPulledBack
            },
            timestamp:   new Date(),
            expiresAt:   null
        });

        return { ghostsRemoved, appointmentsPulledBack };
    }
}
