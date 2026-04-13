import { format, subMinutes } from 'date-fns';
import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IActivityRepository } from '../domain/repositories';
import {
    parseClinicDate,
    getClinicDayOfWeek,
    parseClinicTime,
    addMinutes,
    getClinicTimeString
} from '../domain/services/DateUtils';
import { BreakPeriod, Role, Appointment, KLOQO_ROLES } from '../../../packages/shared/src/index';

export interface ScheduleBreakRequest {
    clinicId: string;
    doctorId: string;
    date: string; // "19 March 2026"
    startTime: string; // "10:30" (HH:mm 24h)
    endTime: string;   // "11:00" (HH:mm 24h)
    sessionIndex: number;
    reason?: string;
    performedBy: { id: string; name: string; role: Role };
    /**
     * DRY RUN MODE: If true, the full Gap Absorption math is executed and
     * the preview[] is returned, but NO database writes are committed.
     * Use this to render the "What Happens Next?" summary before the user confirms.
     * The frontend must make a SECOND call with isDryRun=false to actually commit.
     */
    isDryRun?: boolean;
    /**
     * COMPENSATION MODE:
     * - 'GAP_ABSORPTION' (default): Only shifts day by (occupied_slots * slotDuration).
     * - 'FULL_COMPENSATION': Shifts day by the TOTAL break duration, even if slots were empty.
     */
    compensationMode?: 'GAP_ABSORPTION' | 'FULL_COMPENSATION';
}

export interface ScheduleBreakResult {
    breakPeriod: BreakPeriod;
    shiftedCount: number;       // patients actually delayed
    ghostsCreated: number;      // blocker slots created
    delayMinutes: number;       // actual delay applied (Gap Absorption result)
    preview: Array<{ tokenNumber: string; oldTime: string; newTime: string; deltaMinutes: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
/** Only notify patients if their appointment shifts by more than this threshold */
const NOTIFICATION_THRESHOLD_MINUTES = 15;

export class ScheduleBreakUseCase {
    constructor(
        private appointmentRepo: IAppointmentRepository,
        private doctorRepo: IDoctorRepository,
        private clinicRepo: IClinicRepository,
        private activityRepo: IActivityRepository
    ) {}

    async execute(request: ScheduleBreakRequest): Promise<ScheduleBreakResult> {
        const { 
            clinicId, 
            doctorId, 
            date, 
            startTime, 
            endTime, 
            sessionIndex, 
            reason, 
            performedBy, 
            isDryRun = false,
            compensationMode = 'GAP_ABSORPTION'
        } = request;

        // ── 1. LOAD & AUTHORIZE ──────────────────────────────────────────────
        const doctor = await this.doctorRepo.findById(doctorId);
        if (!doctor) throw new Error('Doctor not found');

        // CLINIC SCOPING GUARD
        if (doctor.clinicId !== clinicId) {
            throw new Error('Unauthorized: Doctor does not belong to this clinic.');
        }

        // RBAC: Self, Admins, or Clinical Staff (Nurses/Receptionists)
        const isSelfInitiated = performedBy.id === doctor.id || performedBy.id === doctor.userId;
        const isManagement   = ([KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN] as Role[]).includes(performedBy.role);
        const isClinicalStaff = ([KLOQO_ROLES.NURSE, KLOQO_ROLES.RECEPTIONIST] as Role[]).includes(performedBy.role);

        if (!isSelfInitiated && !isManagement && !isClinicalStaff) {
            throw new Error('Unauthorized: You do not have permission to manage this doctor\'s schedule.');
        }

        const clinic = await this.clinicRepo.findById(clinicId);
        if (!clinic) throw new Error('Clinic not found');

        // ── 2. PARSE TIMES ───────────────────────────────────────────────────
        const baseDate = parseClinicDate(date);
        const breakStart = parseClinicTime(startTime, baseDate);
        const breakEnd   = parseClinicTime(endTime,   baseDate);

        if (breakEnd <= breakStart) throw new Error('End time must be after start time');

        const breakDurationMinutes = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);

        // ── 3. LOAD TODAY'S APPOINTMENTS ─────────────────────────────────────
        const allAppointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, date);

        // Guard: Reject if another break already overlaps this window in this session
        const existingBreaks: BreakPeriod[] = (doctor.breakPeriods?.[date] || [])
            .filter((b: any) => b.sessionIndex === sessionIndex);
        for (const existing of existingBreaks) {
            const exStart = parseClinicTime(existing.startTimeFormatted, baseDate);
            const exEnd   = parseClinicTime(existing.endTimeFormatted,   baseDate);
            const overlaps = breakStart < exEnd && breakEnd > exStart;
            if (overlaps) {
                throw new Error(
                    `Break overlaps with an existing break (${existing.startTimeFormatted} – ${existing.endTimeFormatted})`
                );
            }
        }

        // ── 4. VALIDATE SESSION EXISTS & BULKHEAD CHECK ──────────────────────
        const dayOfWeekLabel = getClinicDayOfWeek(baseDate);
        const availability   = doctor.availabilitySlots.find(s => s.day === dayOfWeekLabel);
        if (!availability || !availability.timeSlots[sessionIndex]) {
            throw new Error('No availability for this session');
        }
        const sessionSlot = availability.timeSlots[sessionIndex];
        const sessionEnd  = parseClinicTime(sessionSlot.to, baseDate);

        // WATERTIGHT BULKHEAD: break must end before OR at session end
        if (breakEnd > sessionEnd) {
            throw new Error(
                `Break cannot extend beyond session end (${sessionSlot.to}). ` +
                `Please shorten the break or add it to the next session.`
            );
        }

        // ── 5. GAP ABSORPTION — calculate actualShift based on occupancy ──────
        //
        // RULE: We only delay the rest of the day by (occupied_slots_in_break * slotDuration).
        // A break over 2 empty slots and 1 occupied slot only shifts the day by 15 min, not 30.
        //
        const slotDuration = doctor.averageConsultingTime || 15;

        // Real appointments that fall within the break window (not system blockers, not cancelled)
        const appointmentsInBreak = allAppointments.filter(a => {
            if (a.sessionIndex !== sessionIndex) return false;
            if (a.status === 'Cancelled' || a.isSystemBlocker) return false;
            const t = parseClinicTime(a.arriveByTime || a.time, baseDate);
            return t >= breakStart && t < breakEnd;
        });

        const occupiedSlotsInBreak = appointmentsInBreak.length;
        
        let actualShiftMinutes: number;
        if (compensationMode === 'FULL_COMPENSATION') {
            actualShiftMinutes = breakDurationMinutes;
        } else {
            actualShiftMinutes = occupiedSlotsInBreak * slotDuration;
        }

        // ── 6. APPLY SHIFT to post-break appointments in SAME SESSION ONLY ───
        //
        // BULKHEAD: We only touch appointments in this sessionIndex. Session 2 is never affected.
        //
        const postBreakAppointments = allAppointments.filter(a => {
            if (a.sessionIndex !== sessionIndex) return false;
            if (a.status === 'Cancelled' || a.isSystemBlocker) return false;
            const t = parseClinicTime(a.arriveByTime || a.time, baseDate);
            return t >= breakEnd; // strictly after the break
        });

        const preview: ScheduleBreakResult['preview'] = [];
        const shiftedAppointmentIds: string[] = [];

        // Shift appointments in break first (they get displaced to after the break)
        for (const appt of appointmentsInBreak) {
            const oldTime = parseClinicTime(appt.arriveByTime || appt.time, baseDate);
            // Displaced appointments are compacted to start right after the break
            const relativeIndex = appointmentsInBreak.indexOf(appt);
            const newTime       = addMinutes(breakEnd, relativeIndex * slotDuration);
            const deltaMinutes  = Math.round((newTime.getTime() - oldTime.getTime()) / 60000);

            // DRY RUN: skip DB write, math is still executed for the preview
            if (!isDryRun) {
                await this.appointmentRepo.update(appt.id, {
                    time:           format(newTime, 'HH:mm'),
                    arriveByTime:   format(subMinutes(newTime, 15), 'HH:mm'),
                    cancelledByBreak: false, // NOT cancelled — they are just moved
                    updatedAt:      new Date()
                });
            }

            shiftedAppointmentIds.push(appt.id);

            if (deltaMinutes >= NOTIFICATION_THRESHOLD_MINUTES) {
                preview.push({
                    tokenNumber: appt.tokenNumber,
                    oldTime:  format(oldTime, 'HH:mm'),
                    newTime:  format(newTime, 'HH:mm'),
                    deltaMinutes
                });
            }
        }

        // Shift post-break appointments by actualShiftMinutes  
        if (actualShiftMinutes > 0) {
            for (const appt of postBreakAppointments) {
                const oldTime  = parseClinicTime(appt.arriveByTime || appt.time, baseDate);
                const newTime  = addMinutes(oldTime, actualShiftMinutes);
                const deltaMin = actualShiftMinutes;

                // DRY RUN: skip DB write
                if (!isDryRun) {
                    await this.appointmentRepo.update(appt.id, {
                        time:         format(newTime, 'HH:mm'),
                        arriveByTime: format(subMinutes(newTime, 15), 'HH:mm'),
                        updatedAt:    new Date()
                    });
                }

                if (deltaMin >= NOTIFICATION_THRESHOLD_MINUTES) {
                    preview.push({
                        tokenNumber: appt.tokenNumber,
                        oldTime:  format(oldTime, 'HH:mm'),
                        newTime:  format(newTime, 'HH:mm'),
                        deltaMinutes: deltaMin
                    });
                }
            }
        }

        // ── 7. GHOST GENERATION — hard-block empty break slots in DB ─────────
        //
        // For every slot in the break range that does NOT already have an appointment,
        // we insert a "ghost" record. This ensures the scheduling engine (which counts
        // occupied DB rows) never double-books into a break slot — even under race conditions.
        //
        // Analytics GUARDRAIL: `isSystemBlocker: true` MUST always be set here.
        // Every UseCase that counts patients, revenue, or appointments MUST filter
        // out records where `isSystemBlocker === true`.
        //
        const totalBreakSlots = Math.ceil(breakDurationMinutes / slotDuration);
        const alreadyOccupiedSlotTimes = new Set<string>(
            appointmentsInBreak.map(a => a.arriveByTime || a.time)
        );

        let ghostsCreated = 0;
        for (let i = 0; i < totalBreakSlots; i++) {
            const slotTime    = addMinutes(breakStart, i * slotDuration);
            const slotTimeStr = format(slotTime, 'HH:mm');

            if (alreadyOccupiedSlotTimes.has(slotTimeStr)) continue; // already covered by real appt move

            // DRY RUN: count but do not write
            if (!isDryRun) {
                const ghostId = `ghost-break-${doctorId}-${date}-${slotTimeStr.replace(':', '')}-${sessionIndex}`;
                await this.appointmentRepo.save({
                    id:            ghostId,
                    patientId:     'system-break-blocker',
                    patientName:   'kloqo break block',
                    doctorId,
                    doctorName:    doctor.name,
                    clinicId,
                    date,
                    time:          slotTimeStr,
                    arriveByTime:  slotTimeStr,
                    slotIndex:     undefined,
                    sessionIndex,
                    status:        'Completed',   // treated as occupied by the scheduler
                    bookedVia:     'BreakBlock',
                    tokenNumber:   'Break',
                    numericToken:  0,
                    cancelledByBreak: true,
                    isSystemBlocker:  true,       // ← ANALYTICS GUARDRAIL flag
                    createdAt:     new Date(),
                    updatedAt:     new Date()
                } as any);
            }

            ghostsCreated++;
        }

        // ── 8. UPDATE DOCTOR BREAK METADATA ──────────────────────────────────
        const breakPeriod: BreakPeriod = {
            id:                 `break-${Date.now()}`,
            startTime:          breakStart.toISOString(),
            endTime:            breakEnd.toISOString(),
            startTimeFormatted: startTime,
            endTimeFormatted:   endTime,
            duration:           breakDurationMinutes,
            actualShiftMinutes: actualShiftMinutes,
            sessionIndex,
            slots:              [],
            type:               'BREAK',
            createdAt:          new Date().toISOString()
        };

        const breakPeriods = doctor.breakPeriods || {};
        const dateBreaks   = breakPeriods[date]   || [];
        dateBreaks.push(breakPeriod);
        breakPeriods[date] = dateBreaks;

        // Update availabilityExtensions — use actualShiftMinutes (Gap Absorption), not full duration
        const availabilityExtensions = doctor.availabilityExtensions || {};
        const dateExtensions         = availabilityExtensions[date]   || { sessions: [] };

        const sessionExtIndex = dateExtensions.sessions.findIndex((s: any) => s.sessionIndex === sessionIndex);
        if (sessionExtIndex >= 0) {
            dateExtensions.sessions[sessionExtIndex].totalExtendedBy += actualShiftMinutes;
            const currentEndTime = parseClinicTime(dateExtensions.sessions[sessionExtIndex].newEndTime, baseDate);
            dateExtensions.sessions[sessionExtIndex].newEndTime = getClinicTimeString(addMinutes(currentEndTime, actualShiftMinutes));
        } else {
            const originalEnd = parseClinicTime(sessionSlot.to, baseDate);
            dateExtensions.sessions.push({
                sessionIndex,
                totalExtendedBy: actualShiftMinutes,
                newEndTime:      getClinicTimeString(addMinutes(originalEnd, actualShiftMinutes))
            });
        }
        availabilityExtensions[date] = dateExtensions;

        // DRY RUN: skip all persistence (doctor metadata + audit log)
        if (!isDryRun) {
            await this.doctorRepo.update(doctorId, {
                breakPeriods,
                availabilityExtensions,
                updatedAt: new Date()
            });

            // ── 9. AUDIT LOG ─────────────────────────────────────────────────
            await this.activityRepo.save({
                id:          '',
                type:        'SCHEDULING_CHANGE',
                action:      'SCHEDULE_BREAK',
                doctorId,
                clinicId,
                performedBy,
                details: {
                    date,
                    startTime,
                    endTime,
                    sessionIndex,
                    reason:             reason || null,
                    breakDuration:      breakDurationMinutes,
                    actualShiftApplied: actualShiftMinutes,
                    occupiedSlotsInBreak,
                    shiftedCount:       postBreakAppointments.length + appointmentsInBreak.length,
                    ghostsCreated,
                    notifiableCount:    preview.length
                },
                timestamp:   new Date(),
                expiresAt:   null
            });
        }

        return {
            breakPeriod,
            shiftedCount:  postBreakAppointments.length + appointmentsInBreak.length,
            ghostsCreated,
            delayMinutes:  actualShiftMinutes,
            preview
        };
    }
}
