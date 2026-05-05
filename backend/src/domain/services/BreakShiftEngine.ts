// ╔══════════════════════════════════════════════════════════════════════════╗
// ║                    ⚠️  AI GUARD — DO NOT EDIT                           ║
// ║                                                                          ║
// ║  This file contains the Gravity Anchor Break Shift Engine.               ║
// ║  It encodes complex, validated break scheduling logic including:         ║
// ║    • Gap Absorption Mode: reduces wait-time ripple by recovering         ║
// ║      time from empty slots within the break window.                      ║
// ║    • Shift Ripple Calculation: cascades time changes to all              ║
// ║      downstream patients after a break is applied.                       ║
// ║    • Ghost Block Injection: creates isSystemBlocker documents to         ║
// ║      prevent double-booking of break-occupied slots.                     ║
// ║                                                                          ║
// ║  ✅ This logic has been verified against test snapshots in:              ║
// ║     backend/test_results/                                                ║
// ║                                                                          ║
// ║  🚫 AI models MUST NOT modify this file without explicit written         ║
// ║     permission from the project owner (Jino Devasia).                   ║
// ║     Any change requires re-running the full snapshot regression suite.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { Appointment, Doctor, BreakPeriod, Clinic } from '../../../../packages/shared/src/index';
import { 
    parseClinicTime, 
    parseClinicDate,
    getClinicTimeString, 
    getClinicISODateString,
    addMinutes, 
    differenceInMinutes,
    isBefore
} from './DateUtils';
import { subMinutes } from 'date-fns';

export interface ShiftSimulationResult {
    updates: Partial<Appointment>[];
    newGhosts: Partial<Appointment>[];
    extensionUpdates: Record<number, number>; // sessionIndex -> extensionMinutes
}

export class BreakShiftEngine {
    /**
     * simulateDayShifts
     * 
     * The Gravity Engine's core. Re-simulates an entire day's schedule from
     * immutable anchors (originalTime) based on a set of active breaks.
     */
    static simulateDayShifts(
        doctor: Doctor,
        clinic: Clinic,
        date: string,
        allAppointments: Appointment[],
        activeBreaks: BreakPeriod[],
        mode: 'FULL_COMPENSATION' | 'GAP_ABSORPTION' = 'GAP_ABSORPTION'
    ): ShiftSimulationResult {
        const slotDuration = doctor.averageConsultingTime || 15;
        const updates: Partial<Appointment>[] = [];
        const newGhosts: Partial<Appointment>[] = [];
        const extensionUpdates: Record<number, number> = {};

        // 1. FILTER: The History Lock
        const futureAppointments = allAppointments.filter(a => 
            !a.isSystemBlocker && 
            ['Pending', 'Confirmed'].includes(a.status)
        );

        // 2. RESET: Back to Gravity
        const workingAppts = futureAppointments.map(a => ({
            ...a,
            time: a.originalTime || a.time,
            arriveByTime: a.originalArriveByTime || a.arriveByTime
        }));

        // 3. PREPARE SESSIONS (Respect overrides)
        const dateStrIso = getClinicISODateString(parseClinicDate(date));
        const override = doctor.dateOverrides?.[dateStrIso];
        
        let sessions: any[] = [];
        if (override && override.slots && override.slots.length > 0) {
            sessions = override.slots;
        } else {
            const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(parseClinicDate(date));
            const availability = doctor.availabilitySlots.find(s => s.day === dayOfWeek);
            sessions = availability?.timeSlots || [];
        }

        sessions.forEach((session, sIdx) => {
            const sessionStart = parseClinicTime(session.from, parseClinicDate(date));
            const sessionEnd = parseClinicTime(session.to, parseClinicDate(date));
            const sessionBreaks = activeBreaks.filter(b => b.sessionIndex === sIdx)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
            
            const sessionAppts = workingAppts.filter(a => a.sessionIndex === sIdx)
                .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

            let currentOffset = 0;
            let currentFreeTime = sessionStart;

            const now = new Date();
            // Step A: Fill Ghosts & Track Break Blocks
            sessionBreaks.forEach(brk => {
                const bStart = parseClinicTime(brk.startTimeFormatted || brk.startTime, parseClinicDate(date));
                const bEnd = parseClinicTime(brk.endTimeFormatted || brk.endTime, parseClinicDate(date));
                const bDuration = differenceInMinutes(bEnd, bStart);

                // Add Ghosts
                const totalGhosts = Math.ceil(bDuration / slotDuration);
                for (let i = 0; i < totalGhosts; i++) {
                    const ghostTime = addMinutes(bStart, i * slotDuration);
                    const ghostTimeStr = getClinicTimeString(ghostTime);
                    
                    // Calculate precise slotIndex to ensure robust matching in GetAvailableSlots
                    const minutesFromSessionStart = differenceInMinutes(ghostTime, sessionStart);
                    const localSlotIndex = Math.floor(minutesFromSessionStart / slotDuration);
                    const globalSlotIndex = (sIdx * 1000) + localSlotIndex;

                    newGhosts.push({
                        id: `ghost-break-${doctor.id}-${date}-${ghostTimeStr.replace(':', '')}-${sIdx}`,
                        patientId: 'system-break-blocker',
                        patientName: 'kloqo break block',
                        doctorId: doctor.id,
                        doctorName: doctor.name,
                        clinicId: doctor.clinicId,
                        date,
                        time: ghostTimeStr,
                        arriveByTime: ghostTimeStr,
                        sessionIndex: sIdx,
                        slotIndex: globalSlotIndex, // CRITICAL: For robust matching
                        status: 'Completed',
                        bookedVia: 'BreakBlock',
                        tokenNumber: 'Break',
                        numericToken: 0,
                        isSystemBlocker: true,
                        createdAt: now,
                        updatedAt: now
                    });
                }
            });

            // Step B: Simulate Patient Ripple
            // "Gap Absorption" Logic: Patients only move if currentFreeTime > their original time.
            sessionAppts.forEach(appt => {
                const origTime = parseClinicTime(appt.originalTime || appt.time, parseClinicDate(date));
                
                // 1. Check if any break overlaps with or precedes this patient
                sessionBreaks.forEach(brk => {
                    const bStart = parseClinicTime(brk.startTimeFormatted || brk.startTime, parseClinicDate(date));
                    const bEnd = parseClinicTime(brk.endTimeFormatted || brk.endTime, parseClinicDate(date));
                    
                    // If break is before or at the current patient's time
                    if (bStart <= origTime || (mode === 'FULL_COMPENSATION' && bStart <= addMinutes(origTime, currentOffset))) {
                         // In Full Compensation, every break adds its full duration to the offset
                         if (mode === 'FULL_COMPENSATION') {
                             // We don't use currentFreeTime for Full Comp, we just add the delta
                         } else {
                             // In Gap Absorption, we push currentFreeTime to the end of the break
                             if (bEnd > currentFreeTime) currentFreeTime = bEnd;
                         }
                    }
                });

                if (mode === 'FULL_COMPENSATION') {
                    // Full Compensation: Just add the total duration of all breaks that started before this appt
                    const totalBreakShift = sessionBreaks
                        .filter(b => parseClinicTime(b.startTimeFormatted || b.startTime, parseClinicDate(date)) <= origTime)
                        .reduce((acc, b) => acc + differenceInMinutes(parseClinicTime(b.endTimeFormatted || b.endTime, parseClinicDate(date)), parseClinicTime(b.startTimeFormatted || b.startTime, parseClinicDate(date))), 0);
                    
                    const newTime = addMinutes(origTime, totalBreakShift);
                    appt.time = getClinicTimeString(newTime);
                    appt.arriveByTime = getClinicTimeString(subMinutes(newTime, 15));
                    if (newTime > sessionEnd) appt.isOverflow = true;
                } else {
                    // Gap Absorption: Patient starts at MAX(originalTime, currentFreeTime)
                    const actualStart = origTime > currentFreeTime ? origTime : currentFreeTime;
                    
                    if (actualStart > origTime) {
                        appt.time = getClinicTimeString(actualStart);
                        appt.arriveByTime = getClinicTimeString(subMinutes(actualStart, 15));
                        if (actualStart > sessionEnd) appt.isOverflow = true;
                    }
                    
                    currentFreeTime = addMinutes(actualStart, slotDuration);
                }
            });

            // Step C: Calculate Extension
            // Extension is the delay of the LAST patient's completion beyond sessionEnd
            if (sessionAppts.length > 0) {
                const lastAppt = sessionAppts[sessionAppts.length - 1];
                const lastApptStart = parseClinicTime(lastAppt.time, parseClinicDate(date));
                const lastApptEnd = addMinutes(lastApptStart, slotDuration);
                
                if (lastApptEnd > sessionEnd) {
                    extensionUpdates[sIdx] = differenceInMinutes(lastApptEnd, sessionEnd);
                } else {
                    extensionUpdates[sIdx] = 0;
                }
            } else {
                // No patients? Extension is just the overflow of the last break
                if (sessionBreaks.length > 0) {
                    const lastBreak = sessionBreaks[sessionBreaks.length - 1];
                    const bEnd = parseClinicTime(lastBreak.endTimeFormatted || lastBreak.endTime, parseClinicDate(date));
                    if (bEnd > sessionEnd) {
                        extensionUpdates[sIdx] = differenceInMinutes(bEnd, sessionEnd);
                    } else {
                        extensionUpdates[sIdx] = 0;
                    }
                }
            }
        });

        // 4. CONSOLIDATE UPDATES
        workingAppts.forEach(appt => {
            const original = futureAppointments.find(oa => oa.id === appt.id);
            if (original && (original.time !== appt.time || original.arriveByTime !== appt.arriveByTime)) {
                updates.push({
                    id: appt.id,
                    clinicId: appt.clinicId,
                    time: appt.time,
                    arriveByTime: appt.arriveByTime,
                    isOverflow: appt.isOverflow,
                    updatedAt: new Date()
                });
            }
        });

        return {
            updates,
            newGhosts,
            extensionUpdates
        };
    }
}
