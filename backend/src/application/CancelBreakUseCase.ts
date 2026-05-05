// ╔══════════════════════════════════════════════════════════════════════════╗
// ║                    ⚠️  AI GUARD — DO NOT EDIT                           ║
// ║                                                                          ║
// ║  This file contains the Break Cancellation Use Case.                    ║
// ║  It orchestrates a critical multi-step transaction including:            ║
// ║    • Ghost deletion: removes isSystemBlocker BreakBlock documents.       ║
// ║    • Re-simulation: runs BreakShiftEngine without the cancelled break    ║
// ║      to restore original appointment times (snap-back).                  ║
// ║    • Vacuum trigger: calls QueueBubblingService.reoptimize() to          ║
// ║      promote walk-in tokens into newly freed gaps, preserving            ║
// ║      FIFO fairness for patients who were already waiting.               ║
// ║                                                                          ║
// ║  ✅ This logic has been verified against test snapshots in:              ║
// ║     backend/test_results/                                                ║
// ║                                                                          ║
// ║  🚫 AI models MUST NOT modify this file without explicit written         ║
// ║     permission from the project owner (Jino Devasia).                   ║
// ║     Any change requires re-running the full snapshot regression suite.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IActivityRepository, ITransaction } from '../domain/repositories';
import {
    parseClinicDate,
    parseClinicTime,
    getClinicTimeString,
    addMinutes,
    getClinicISODateString,
    getClinicNow
} from '../domain/services/DateUtils';
import { KloqoRole, KLOQO_ROLES, Appointment } from '../../../packages/shared/src/index';
import { BreakShiftEngine } from '../domain/services/BreakShiftEngine';
import { QueueBubblingService } from '../domain/services/QueueBubblingService';

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

export class CancelBreakUseCase {
    constructor(
        private appointmentRepo: IAppointmentRepository,
        private doctorRepo: IDoctorRepository,
        private clinicRepo: IClinicRepository,
        private activityRepo: IActivityRepository,
        private queueBubblingService: QueueBubblingService
    ) {}

    async execute(request: CancelBreakRequest): Promise<CancelBreakResult> {
        const { clinicId, doctorId, breakId, date, performedBy, shouldPullForward = true } = request;

        const doctor = await this.doctorRepo.findById(doctorId, clinicId);
        if (!doctor) throw new Error('Doctor not found');

        const now = getClinicNow();
        const todayBaseline = parseClinicDate(getClinicISODateString(now));
        const baseDate = parseClinicDate(date);
        
        if (baseDate.getTime() < todayBaseline.getTime()) {
            throw new Error('Cannot cancel breaks for past dates');
        }

        const clinic = await this.clinicRepo.findById(clinicId);
        if (!clinic) throw new Error('Clinic not found');
        const breakPeriods = doctor.breakPeriods || {};
        const isoDate = getClinicISODateString(baseDate);
        const legacyDate = date;

        // Fetch from both to find the break
        const allBreaks = [...(breakPeriods[isoDate] || []), ...(breakPeriods[legacyDate] || [])];
        const breakToRemove = allBreaks.find((b: any) => b.id === breakId);
        if (!breakToRemove) throw new Error('Break not found');

        // Remove from both and sync
        const updatedBreaks = allBreaks.filter((b: any) => b.id !== breakId);
        
        // Deduplicate
        const breakMap = new Map<string, any>();
        updatedBreaks.forEach(b => breakMap.set(b.id, b));
        const finalBreaks = Array.from(breakMap.values());

        breakPeriods[legacyDate] = finalBreaks;
        breakPeriods[isoDate] = finalBreaks;

        if (finalBreaks.length === 0) {
            delete breakPeriods[legacyDate];
            delete breakPeriods[isoDate];
        }

        // Fetch all appointments for BOTH date keys to avoid ghost leaks
        const [legacyAppts, isoAppts] = await Promise.all([
            this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, legacyDate),
            this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, isoDate)
        ]);
        const apptTable = new Map<string, Appointment>();
        [...legacyAppts, ...isoAppts].forEach(a => apptTable.set(a.id, a));
        const allAppointments = Array.from(apptTable.values());
        
        const breakBlockGhosts = allAppointments.filter(a => a.isSystemBlocker && a.bookedVia === 'BreakBlock');

        // RE-SIMULATE WITHOUT THE CANCELLED BREAK
        const simulation = BreakShiftEngine.simulateDayShifts(
            doctor, clinic, date, allAppointments, finalBreaks, 'GAP_ABSORPTION'
        );

        await this.appointmentRepo.runTransaction(async (txn: ITransaction) => {
            // 1. Wipe all BreakBlock ghosts
            for (const ghost of breakBlockGhosts) {
                await this.appointmentRepo.delete(ghost.id, clinicId, txn);
            }

            // 2. Apply re-simulated updates
            for (const update of simulation.updates) {
                await this.appointmentRepo.update(update.id!, clinicId, update, txn);
            }

            // 3. Save new ghosts (based on remaining breaks)
            for (const ghost of simulation.newGhosts) {
                await this.appointmentRepo.save(ghost as Appointment, clinicId, txn);
            }

            // 4. Update Doctor (Extensions & Breaks)
            const availabilityExtensions = doctor.availabilityExtensions || {};
            const dateExtensions = { sessions: [] as any[] };
            Object.entries(simulation.extensionUpdates).forEach(([sIdx, ext]) => {
                const sessionIndexNum = parseInt(sIdx);
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

            await this.doctorRepo.update(doctorId, clinicId, { breakPeriods, availabilityExtensions }, txn);
            await this.doctorRepo.saveBreaks(doctorId, clinicId, date, finalBreaks, txn);

            // 5. Trigger Bubbling (Vacuum) to pull walk-ins into newly created gaps
            // This ensures fairness after a break cancellation pushes A-tokens back.
            if (shouldPullForward) {
                // We run this inside the transaction to ensure atomicity
                // SlotScheduler re-optimized view will be visible immediately
                for (let i = 0; i < doctor.availabilitySlots.length; i++) {
                    await this.queueBubblingService.reoptimize({
                        sessionIndex: i,
                        doctorId,
                        clinicId,
                        date: isoDate,
                        transaction: txn
                    });
                }
            }
        });

        this.doctorRepo.invalidateCache(doctorId, clinicId);

        await this.activityRepo.save({
            id: '', type: 'SCHEDULING_CHANGE', action: 'CANCEL_BREAK', doctorId, clinicId, performedBy,
            details: { date, breakId, startTime: breakToRemove.startTimeFormatted, endTime: breakToRemove.endTimeFormatted },
            timestamp: new Date(), expiresAt: null
        });

        return { 
            ghostsRemoved: breakBlockGhosts.length, 
            appointmentsPulledBack: simulation.updates.length 
        };
    }
}
