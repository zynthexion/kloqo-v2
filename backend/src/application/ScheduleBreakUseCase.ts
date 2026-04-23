import { format, subMinutes } from 'date-fns';
import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IActivityRepository } from '../domain/repositories';
import {
    parseClinicDate,
    getClinicDayOfWeek,
    parseClinicTime,
    addMinutes,
    getClinicTimeString,
    getClinicISODateString
} from '../domain/services/DateUtils';
import { BreakPeriod, KloqoRole, Appointment, KLOQO_ROLES } from '../../../packages/shared/src/index';
import { db } from '../infrastructure/firebase/config';

export type BreakCompensationMode = 'GAP_ABSORPTION' | 'FULL_COMPENSATION';

export interface ScheduleBreakRequest {
    clinicId: string;
    doctorId: string;
    date: string; // "19 March 2026"
    startTime: string; // "10:30" (HH:mm 24h)
    endTime: string;   // "11:00" (HH:mm 24h)
    sessionIndex: number;
    reason?: string;
    compensationMode?: BreakCompensationMode; // Default to GAP_ABSORPTION
    performedBy: { id: string; name: string; role: KloqoRole };
    /**
     * DRY RUN MODE: If true, the full Gap Absorption math is executed and
     * the preview[] is returned, but NO database writes are committed.
     * Use this to render the "What Happens Next?" summary before the user confirms.
     * The frontend must make a SECOND call with isDryRun=false to actually commit.
     */
    isDryRun?: boolean;
    /**
     * COMPENSATION MODE:
     * Locked strictly to 'GAP_ABSORPTION' per architectural guidelines.
     * Only shifts day by (occupied_slots * slotDuration).
     */
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
            compensationMode = 'GAP_ABSORPTION',
            performedBy, 
            isDryRun = false
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
        const isManagement   = ([KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN] as KloqoRole[]).includes(performedBy.role);
        const isClinicalStaff = ([KLOQO_ROLES.NURSE, KLOQO_ROLES.RECEPTIONIST] as KloqoRole[]).includes(performedBy.role);

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

        // ✅ SEQUENCE PROTECTION: Sort appointments chronologically by 'time' before any processing.
        // This ensures that Token #1 remains before Token #2 after shifting.
        allAppointments.sort((a, b) => {
            const tA = parseClinicTime(a.time, baseDate);
            const tB = parseClinicTime(b.time, baseDate);
            return tA.getTime() - tB.getTime();
        });

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
        // ✅ TIMEZONE PROTECTION: Use getClinicISODateString to ensure we match '2026-04-23' 
        // correctly in IST, regardless of server local time.
        const dateKey = getClinicISODateString(baseDate);
        const override = doctor.dateOverrides?.[dateKey];
        
        let sessionSlot: { from: string; to: string };

        if (override) {
            if (override.isOff) throw new Error('Doctor is marked as OFF for this date');
            if (!override.slots || !override.slots[sessionIndex]) {
                throw new Error('No availability for this session (Date Override)');
            }
            sessionSlot = override.slots[sessionIndex];
        } else {
            const dayOfWeekLabel = getClinicDayOfWeek(baseDate);
            const availability   = doctor.availabilitySlots.find(s => s.day === dayOfWeekLabel);
            if (!availability || !availability.timeSlots[sessionIndex]) {
                throw new Error('No availability for this session');
            }
            sessionSlot = availability.timeSlots[sessionIndex];
        }

        const sessionEnd  = parseClinicTime(sessionSlot.to, baseDate);

        const batch = db.batch(); // Global batch for all mutations

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
        // ✅ STRATEGY CHANGE: We now use 'time' (consultation) as the source of truth for break impact.
        // This ensures patients whose slots fall in the break are moved even if they had early arriveByTimes.
        const appointmentsInBreak = allAppointments.filter(a => {
            if (a.sessionIndex !== sessionIndex) return false;
            if (a.status === 'Cancelled' || a.isSystemBlocker) return false;
            const t = parseClinicTime(a.time, baseDate);
            return t >= breakStart && t < breakEnd;
        });

        const occupiedSlotsInBreak = appointmentsInBreak.length;
        
        // 🛡️ COMPENSATION STRATEGY 🛡️
        // FULL_COMPENSATION: Shift the day by the total break duration, effectively recovering the time.
        // GAP_ABSORPTION: Shift the day only by the occupied slots (efficient for minimal patient delay).
        let actualShiftMinutes = compensationMode === 'FULL_COMPENSATION'
            ? breakDurationMinutes
            : occupiedSlotsInBreak * slotDuration;

        // ── 6. APPLY SHIFT to post-break appointments in SAME SESSION ONLY ───
        //
        // BULKHEAD: We only touch appointments in this sessionIndex. Session 2 is never affected.
        //
        const postBreakAppointments = allAppointments.filter(a => {
            if (a.sessionIndex !== sessionIndex) return false;
            if (a.status === 'Cancelled' || a.isSystemBlocker) return false;
            const t = parseClinicTime(a.time, baseDate);
            return t >= breakEnd; // strictly after the break
        });

        const preview: ScheduleBreakResult['preview'] = [];
        const shiftedAppointmentIds: string[] = [];

        // Shift appointments in break first (they get displaced to after the break)
        for (const appt of appointmentsInBreak) {
            const oldTime = parseClinicTime(appt.time, baseDate);
            // Displaced appointments are compacted to start right after the break
            const relativeIndex = appointmentsInBreak.indexOf(appt);
            const newTime       = addMinutes(breakEnd, relativeIndex * slotDuration);
            const deltaMinutes  = Math.round((newTime.getTime() - oldTime.getTime()) / 60000);

            // DRY RUN: skip DB write, math is still executed for the preview
            if (!isDryRun) {
                const apptRef = db.collection('appointments').doc(appt.id);
                batch.update(apptRef, {
                    time:           getClinicTimeString(newTime),
                    arriveByTime:   getClinicTimeString(subMinutes(newTime, 15)),
                    cancelledByBreak: false, // NOT cancelled — they are just moved
                    updatedAt:      new Date()
                });
            }

            shiftedAppointmentIds.push(appt.id);

            if (deltaMinutes >= NOTIFICATION_THRESHOLD_MINUTES) {
                preview.push({
                    tokenNumber: appt.tokenNumber,
                    oldTime:  getClinicTimeString(oldTime),
                    newTime:  getClinicTimeString(newTime),
                    deltaMinutes
                });
            }
        }

        // Shift post-break appointments by actualShiftMinutes  
        if (actualShiftMinutes > 0) {
            for (const appt of postBreakAppointments) {
                const oldTime  = parseClinicTime(appt.time, baseDate);
                const newTime  = addMinutes(oldTime, actualShiftMinutes);
                const deltaMin = actualShiftMinutes;

                // DRY RUN: skip DB write
                if (!isDryRun) {
                    const apptRef = db.collection('appointments').doc(appt.id);
                    batch.update(apptRef, {
                        time:         getClinicTimeString(newTime),
                        arriveByTime: getClinicTimeString(subMinutes(newTime, 15)),
                        updatedAt:    new Date()
                    });
                }

                if (deltaMin >= NOTIFICATION_THRESHOLD_MINUTES) {
                    preview.push({
                        tokenNumber: appt.tokenNumber,
                        oldTime:  getClinicTimeString(oldTime),
                        newTime:  getClinicTimeString(newTime),
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
            appointmentsInBreak.map(a => a.time)
        );

        let ghostsCreated = 0;
        for (let i = 0; i < totalBreakSlots; i++) {
            const slotTime    = addMinutes(breakStart, i * slotDuration);
            const slotTimeStr = getClinicTimeString(slotTime);

            if (alreadyOccupiedSlotTimes.has(slotTimeStr)) continue; // already covered by real appt move

            // DRY RUN: count but do not write
            if (!isDryRun) {
                const ghostId = `ghost-break-${doctorId}-${date}-${slotTimeStr.replace(':', '')}-${sessionIndex}`;
                const ghostRef = db.collection('appointments').doc(ghostId);
                batch.set(ghostRef, {
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
                }, { merge: true });
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
            const doctorRef = db.collection('doctors').doc(doctorId);
            batch.update(doctorRef, {
                breakPeriods,
                availabilityExtensions,
                updatedAt: new Date()
            });

            // ── 9. AUDIT LOG ─────────────────────────────────────────────────
            const activityRef = db.collection('activity_logs').doc();
            batch.set(activityRef, {
                id:          activityRef.id,
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

            await batch.commit();
            // Cache invalidation required when bypassing repository
            if (this.doctorRepo.invalidateCache) {
                this.doctorRepo.invalidateCache(doctorId, clinicId);
            }
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
