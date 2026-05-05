// ╔══════════════════════════════════════════════════════════════════════════╗
// ║                    ⚠️  AI GUARD — DO NOT EDIT                           ║
// ║                                                                          ║
// ║  This file contains the Schedule Break Use Case.                         ║
// ║  It is the primary entry point for injecting immutable break blockers.    ║
// ║                                                                          ║
// ║  🚫 AI models MUST NOT modify this file without explicit written         ║
// ║     permission from the project owner (Jino Devasia).                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IActivityRepository, ITransaction } from '../domain/repositories';
import {
    parseClinicDate,
    parseClinicTime,
    getClinicTimeString,
    getClinicISODateString,
    getClinicNow,
    addMinutes
} from '../domain/services/DateUtils';
import { BreakPeriod, KloqoRole, KLOQO_ROLES, Appointment } from '../../../packages/shared/src/index';
import { NotificationService } from '../domain/services/NotificationService';
import { BreakShiftEngine } from '../domain/services/BreakShiftEngine';

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
    allowExtension?: boolean;
    replaceBreakId?: string; // NEW: Support atomic update
    performedBy: { id: string; name: string; role: KloqoRole };
    isDryRun?: boolean;
}

export interface ScheduleBreakResult {
    breakPeriod: BreakPeriod;
    shiftedCount: number;
    ghostsCreated: number;
    delayMinutes: number;
    overflowCount: number;
    preview: Array<{ tokenNumber: string; oldTime: string; newTime: string; deltaMinutes: number; isOverflow: boolean }>;
}

export class ScheduleBreakUseCase {
    constructor(
        private appointmentRepo: IAppointmentRepository,
        private doctorRepo: IDoctorRepository,
        private clinicRepo: IClinicRepository,
        private activityRepo: IActivityRepository,
        private notificationService?: NotificationService
    ) {}

    async execute(request: ScheduleBreakRequest): Promise<ScheduleBreakResult> {
        const { 
            clinicId, doctorId, date, startTime, endTime, 
            sessionIndex, reason, compensationMode = 'GAP_ABSORPTION',
            allowExtension = true, replaceBreakId,
            performedBy, isDryRun = false
        } = request;

        const doctor = await this.doctorRepo.findById(doctorId, clinicId);
        if (!doctor) throw new Error('Doctor not found');

        const now = getClinicNow();
        const todayBaseline = parseClinicDate(getClinicISODateString(now));
        const baseDate = parseClinicDate(date);
        
        if (baseDate.getTime() < todayBaseline.getTime()) {
            throw new Error('Cannot schedule or edit breaks for past dates');
        }

        const clinic = await this.clinicRepo.findById(clinicId);
        if (!clinic) throw new Error('Clinic not found');

        const breakStart = parseClinicTime(startTime, baseDate);
        const breakEnd = parseClinicTime(endTime, baseDate);
        if (breakEnd <= breakStart) throw new Error('Invalid times');

        const breakDuration = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);

        // 1. PREPARE THE NEW BREAK PERIODS ARRAY
        const breakPeriods = doctor.breakPeriods || {};
        const isoDate = getClinicISODateString(baseDate);
        const legacyDate = date; // "d MMMM yyyy" from frontend

        // Fetch from both possible keys
        let dateBreaks = [...(breakPeriods[isoDate] || []), ...(breakPeriods[legacyDate] || [])];

        // Deduplicate by ID just in case
        const breakMap = new Map<string, any>();
        dateBreaks.forEach(b => breakMap.set(b.id, b));
        dateBreaks = Array.from(breakMap.values());

        // If updating, remove the old one first
        if (replaceBreakId) {
            dateBreaks = dateBreaks.filter((b: any) => b.id !== replaceBreakId);
        }

        // Check for overlaps with REMAINING breaks
        for (const existing of dateBreaks) {
            // Defensive: Only check same session, or check all if session is missing in legacy
            if (existing.sessionIndex !== undefined && existing.sessionIndex !== sessionIndex) continue;
            
            const exStart = parseClinicTime(existing.startTimeFormatted || existing.startTime, baseDate);
            const exEnd = parseClinicTime(existing.endTimeFormatted || existing.endTime, baseDate);
            
            if (isNaN(exStart.getTime()) || isNaN(exEnd.getTime())) {
                console.warn('[ScheduleBreak] Skipping invalid break for overlap check:', existing.id);
                continue;
            }

            if (breakStart < exEnd && breakEnd > exStart) {
                console.error('[ScheduleBreak] Overlap detected!', {
                    new: { start: breakStart.toISOString(), end: breakEnd.toISOString() },
                    existing: { id: existing.id, start: exStart.toISOString(), end: exEnd.toISOString() },
                    replaceId: replaceBreakId
                });
                throw new Error('Overlapping break');
            }
        }

        const newBreak: BreakPeriod = {
            id: replaceBreakId || `break-${Date.now()}`,
            startTime: breakStart.toISOString(),
            endTime: breakEnd.toISOString(),
            startTimeFormatted: startTime,
            endTimeFormatted: endTime,
            duration: breakDuration,
            sessionIndex,
            type: 'BREAK',
            slots: [],
            createdAt: new Date().toISOString()
        };
        
        // Ensure we store it under the requested key (legacy for now as per Nurse App)
        dateBreaks.push(newBreak);
        breakPeriods[legacyDate] = dateBreaks;
        // Also sync to ISO key for modern visibility
        breakPeriods[isoDate] = dateBreaks;

        // 2. FETCH ALL APPOINTMENTS & GHOSTS FOR RE-SIMULATION
        // We fetch from BOTH date keys to ensure a clean wipe (no "ghost leaks")
        const [legacyAppts, isoAppts] = await Promise.all([
            this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, legacyDate),
            this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, isoDate)
        ]);

        const apptTable = new Map<string, Appointment>();
        [...legacyAppts, ...isoAppts].forEach(a => apptTable.set(a.id, a));
        const allDayAppointments = Array.from(apptTable.values());
        
        const breakBlockGhosts = allDayAppointments.filter(a => a.isSystemBlocker && a.bookedVia === 'BreakBlock');

        // 3. RUN SIMULATION (GRAVITY RESET)
        const simulation = BreakShiftEngine.simulateDayShifts(
            doctor, clinic, date, allDayAppointments, dateBreaks,
            compensationMode as any
        );

        // Update newBreak with the actual shift calculated by the engine
        // (In case of Gap Absorption, this might be less than duration)
        newBreak.actualShiftMinutes = simulation.extensionUpdates[sessionIndex] || 0;

        if (isDryRun) {
            return {
                breakPeriod: newBreak,
                shiftedCount: simulation.updates.length,
                ghostsCreated: simulation.newGhosts.length,
                delayMinutes: newBreak.actualShiftMinutes,
                overflowCount: simulation.updates.filter(u => u.isOverflow).length,
                preview: [] // Preview can be derived from simulation.updates if needed
            };
        }

        // 4. ATOMIC TRANSACTION: WIPE AND RE-CREATE
        await this.appointmentRepo.runTransaction(async (txn) => {
            // A. Wipe old break-block ghosts
            for (const ghost of breakBlockGhosts) {
                await this.appointmentRepo.delete(ghost.id, clinicId, txn);
            }

            // B. Apply appointment updates
            for (const update of simulation.updates) {
                await this.appointmentRepo.update(update.id!, clinicId, update, txn);
            }

            // C. Save new ghosts
            for (const ghost of simulation.newGhosts) {
                await this.appointmentRepo.save(ghost as Appointment, clinicId, txn);
            }

            // D. Update Doctor
            const availabilityExtensions = doctor.availabilityExtensions || {};
            if (allowExtension) {
                const dateExtensions = { sessions: [] as any[] };
                Object.entries(simulation.extensionUpdates).forEach(([sIdx, ext]) => {
                    const sessionIndexNum = parseInt(sIdx);
                    // Find original session to get base end time
                    const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(baseDate);
                    const availability = doctor.availabilitySlots.find(s => s.day === dayOfWeek);
                    const session = availability?.timeSlots[sessionIndexNum];
                    if (session) {
                        const originalEnd = parseClinicTime(session.to, baseDate);
                        dateExtensions.sessions.push({
                            sessionIndex: sessionIndexNum,
                            totalExtendedBy: ext,
                            newEndTime: getClinicTimeString(addMinutes(originalEnd, ext))
                        });
                    }
                });
                if (dateExtensions.sessions.length > 0) {
                    availabilityExtensions[date] = dateExtensions;
                } else {
                    delete availabilityExtensions[date];
                }
            }
            
            await this.doctorRepo.update(doctorId, clinicId, { breakPeriods, availabilityExtensions }, txn);
            await this.doctorRepo.saveBreaks(doctorId, clinicId, date, dateBreaks, txn);
        });

        this.doctorRepo.invalidateCache(doctorId, clinicId);
        
        await this.activityRepo.save({
            id: '', type: 'SCHEDULING_CHANGE', action: replaceBreakId ? 'EDIT_BREAK' : 'SCHEDULE_BREAK', 
            doctorId, clinicId, performedBy,
            details: { date, startTime, endTime, sessionIndex, breakId: newBreak.id, replacedId: replaceBreakId },
            timestamp: new Date(), expiresAt: null
        });

        // 5. Notify
        if (this.notificationService) {
            this.notificationService.notifyAllPatientsOfBreak({
                clinicId, doctorId, date, durationMinutes: breakDuration, reason
            }).catch(err => console.error('[Break] Broadcast failed:', err));
        }

        return {
            breakPeriod: newBreak,
            shiftedCount: simulation.updates.length,
            ghostsCreated: simulation.newGhosts.length,
            delayMinutes: newBreak.actualShiftMinutes,
            overflowCount: simulation.updates.filter(u => u.isOverflow).length,
            preview: []
        };
    }
}
