// ╔══════════════════════════════════════════════════════════════════════════╗
// ║                    ⚠️  AI GUARD — DO NOT EDIT                           ║
// ║                                                                          ║
// ║  This file contains the Gravity Anchor Walk-in Placement Engine.         ║
// ║  It encodes complex, validated scheduling logic including:               ║
// ║    • Shadow-Gap Guard: prevents walk-ins from grabbing time-slots        ║
// ║      that appear empty in the DB but are temporally occupied by          ║
// ║      break-shifted advance patients.                                     ║
// ║    • Overflow Placement: calculates new walk-in time from the LAST       ║
// ║      REAL PATIENT's shifted storedTime, not raw session slot times.      ║
// ║                                                                          ║
// ║  ✅ This logic has been verified against test snapshots in:              ║
// ║     backend/test_results/                                                ║
// ║                                                                          ║
// ║  🚫 AI models MUST NOT modify this file without explicit written         ║
// ║     permission from the project owner (Jino Devasia).                   ║
// ║     Any change requires re-running the full snapshot regression suite.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { addMinutes, isAfter } from 'date-fns';
import type { Appointment } from '../../../../packages/shared/src/index';
import type { DailySlot } from './SlotCalculator';
import { BookingSessionEngine } from './BookingSessionEngine';

/**
 * WalkInPlacementService
 *
 * Single-responsibility domain service that determines the optimal slot index
 * for a new Walk-in (W-Token) appointment.
 *
 * Key design decisions:
 *  • A-Token appointments are IMMUTABLE. This service never suggests shifting.
 *  • Advanced Mode uses the "Smart Bubble then Buffer" strategy.
 *  • Classic Mode uses "Linear Interval" against the active session.
 *  • This service is PURE (no I/O). It accepts already-fetched data so
 *    the caller can place it inside a Firestore transaction.
 */
export class WalkInPlacementService {
  /**
   * Finds the most appropriate slot for a new walk-in appointment.
   *
   * @param sessionSlots     All slots belonging to the currently active session
   * @param appointments     All existing appointments for the doctor/date (filtered to session)
   * @param now              The current clinic time (IST)
   * @param mode             'advanced' or 'classic'
   * @param walkInSpacing    The clinic's configured N spacing (used only in Classic mode)
   * @returns                The target DailySlot, or null if no slot is available
   */
  static findOptimalWalkInSlot(
    sessionSlots: DailySlot[],
    appointments: Appointment[],
    now: Date,
    mode: 'classic' | 'advanced',
    walkInSpacing: number,
    isPriority: boolean = false,
    avgConsultingTime: number = 15,
    allowOverflow: boolean = false
  ): DailySlot | null {
    const ACTIVE_STATUSES = new Set(['Pending', 'Confirmed', 'Completed', 'InConsultation']);

    // Build set of occupied slot indices from active appointments
    const occupiedSlotIndices = new Set<number>();
    appointments.forEach(a => {
      if (ACTIVE_STATUSES.has(a.status)) {
        if (typeof a.slotIndex === 'number') {
          occupiedSlotIndices.add(a.slotIndex);
        } else {
          // Fallback: Time-based matching for legacy appointments
          const matchingSlot = sessionSlots.find(s => {
             const slotTimeStr = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(s.time);
             return slotTimeStr === a.time;
          });
          if (matchingSlot) {
            occupiedSlotIndices.add(matchingSlot.index);
          }
        }
      }
    });

    // 🔒 CONSULTATION BOUNDARY LOCK
    // When a session is live, no walk-in — including priority (PW-Token) — may be
    // placed at or below the slot index of:
    //   (A) the patient currently InConsultation (in the room), or
    //   (B) the next Confirmed patient waiting at the door.
    // Priority means "next available after the physical boundary", NOT "displace
    // whoever is already there". Violating this would make the UI irrecoverable.
    const inConsultationAppts = appointments.filter(a => a.status === 'InConsultation');
    const consultationFloor = inConsultationAppts.length > 0
      ? Math.min(...inConsultationAppts.map(a => a.slotIndex ?? Infinity))
      : -1;

    const nextUpConfirmed = appointments
      .filter(a => a.status === 'Confirmed' && (a.slotIndex ?? -1) > consultationFloor)
      .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0))[0];
    const doorFloor = nextUpConfirmed?.slotIndex ?? -1;

    // The hard floor is the MINIMUM of the two live boundaries.
    // No slot at or below this index is eligible for any new walk-in placement.
    const hardFloor = consultationFloor >= 0
      ? Math.min(consultationFloor, doorFloor >= 0 ? doorFloor : consultationFloor)
      : -1;

    if (hardFloor >= 0) {
      console.log(`[WalkInPlacement] 🔒 hardFloor=${hardFloor} (consultationFloor=${consultationFloor}, doorFloor=${doorFloor})`);
    }

    // 🚑 PRIORITY TRIAGE (PW-Token Logic)
    // Priority bypasses rhythmic/spacing constraints but MUST respect the physical
    // consultation boundary. The earliest eligible slot is immediately after the
    // "at-door" patient, not before the patient in the room.
    if (isPriority) {
      const bubbleGap = sessionSlots.find(slot =>
        !occupiedSlotIndices.has(slot.index) &&
        slot.index > hardFloor &&
        isAfter(slot.time, now)
      );
      if (bubbleGap) {
        console.log(`[WalkInPlacement] PRIORITY: Injecting PW-Token into first gap at slot ${bubbleGap.index} (above hardFloor=${hardFloor})`);
        return bubbleGap;
      }
    }

    // 🕐 Build set of occupied TIME strings (from shifted appointments)
    // This detects shadow-gaps: empty slots whose raw session time collides
    // with a shifted patient's stored display time after a break is applied.
    const occupiedTimeStrings = new Set<string>();
    const istFormatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
    });
    appointments.forEach(a => {
      if (ACTIVE_STATUSES.has(a.status) && !(a as any).isSystemBlocker && a.time) {
        occupiedTimeStrings.add(a.time);
      }
    });

    let targetSlot: DailySlot | null = null;
    if (mode === 'advanced') {
      targetSlot = this._findAdvancedSlot(sessionSlots, occupiedSlotIndices, now, hardFloor);
    } else {
      targetSlot = this._findClassicSlot(sessionSlots, occupiedSlotIndices, occupiedTimeStrings, istFormatter, now, walkInSpacing, hardFloor);
    }

    if (targetSlot) return targetSlot;

    if (!allowOverflow) {
      console.warn('[WalkInPlacement] No slots available and allowOverflow is false.');
      return null;
    }

    // 🚨 OVERFLOW LOGIC: Force Book into a virtual slot at the end
    console.warn(`[WalkInPlacement] 🚨 Session full. Triggering Overflow Force-Booking.`);

    const lastSessionSlot = sessionSlots[sessionSlots.length - 1];

    // Find the last REAL appointment (not system blocker) by slotIndex
    const realAppointments = appointments.filter(a =>
      ACTIVE_STATUSES.has(a.status) && !(a as any).isSystemBlocker
    );
    const lastRealAppt = realAppointments.reduce<typeof appointments[0] | null>((max, a) =>
      a.slotIndex !== undefined && (max === null || a.slotIndex > max.slotIndex!) ? a : max,
      null
    );

    const maxOccupiedIndex = lastRealAppt?.slotIndex ?? lastSessionSlot?.index ?? 0;
    const newIndex = maxOccupiedIndex + 1;

    // 🕐 Use last real appointment's STORED time as base (reflects break shifts)
    // Fallback to raw session slot time if unavailable
    let baseTime: Date;
    if (lastRealAppt?.time && sessionSlots.length > 0) {
      const parsed = this._parseTimeToDate(lastRealAppt.time, sessionSlots[0].time);
      baseTime = isAfter(parsed, now) ? parsed : now;
    } else {
      baseTime = lastSessionSlot?.time && isAfter(lastSessionSlot.time, now)
        ? lastSessionSlot.time
        : now;
    }

    const newTime = addMinutes(baseTime, avgConsultingTime);

    return {
      index: newIndex,
      time: newTime,
      sessionIndex: lastSessionSlot?.sessionIndex ?? 0
    };
  }

  /**
   * Parses an "HH:mm" IST time string into a UTC Date using a reference Date
   * (from the session slot) to determine the calendar date in IST.
   */
  private static _parseTimeToDate(timeStr: string, referenceUtcDate: Date): Date {
    const [h, m] = timeStr.split(':').map(Number);
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    // Get the IST calendar date from the reference UTC date
    const istRef = new Date(referenceUtcDate.getTime() + IST_OFFSET_MS);
    // Build a UTC timestamp representing this IST time on the IST date
    const istAsUtc = Date.UTC(istRef.getUTCFullYear(), istRef.getUTCMonth(), istRef.getUTCDate(), h, m, 0, 0);
    // Subtract IST offset to get real UTC
    return new Date(istAsUtc - IST_OFFSET_MS);
  }

  // ── Advanced Mode: Smart Bubble → Buffer Slot ─────────────────────────────

  private static _findAdvancedSlot(
    sessionSlots: DailySlot[],
    occupiedSlotIndices: Set<number>,
    now: Date,
    hardFloor: number
  ): DailySlot | null {
    // PHASE A: Smart Bubble (60-minute window)
    const oneHourFromNow = addMinutes(now, 60);
    const bubbleGap = sessionSlots.find(slot =>
      !occupiedSlotIndices.has(slot.index) &&
      slot.index > hardFloor &&
      !isAfter(slot.time, oneHourFromNow) &&
      isAfter(slot.time, now)
    );

    if (bubbleGap) {
      console.log(`[WalkInPlacement] PHASE A: Bubbling walk-in into gap at slot ${bubbleGap.index}`);
      return bubbleGap;
    }

    // PHASE B: Buffer Slot Assignment
    const reservedSlotIndices = BookingSessionEngine.calculateReservedSlots(sessionSlots, now);
    const bufferSlot = sessionSlots.find(slot =>
      reservedSlotIndices.has(slot.index) &&
      !occupiedSlotIndices.has(slot.index) &&
      slot.index > hardFloor &&
      isAfter(slot.time, now)
    );

    if (bufferSlot) {
      console.log(`[WalkInPlacement] PHASE B: Assigning walk-in to buffer slot ${bufferSlot.index}`);
      return bufferSlot;
    }

    return null;
  }

  // ── Classic Mode: Pure Greedy Placement (The Vacuum-Protected Strategy) ──

  private static _findClassicSlot(
    sessionSlots: DailySlot[],
    occupiedSlotIndices: Set<number>,
    occupiedTimeStrings: Set<string>,
    istFormatter: Intl.DateTimeFormat,
    now: Date,
    walkInSpacing: number,
    hardFloor: number
  ): DailySlot | null {
    /**
     * PURE GREED STRATEGY:
     * Scan every slot chronologically after 'now' and above hardFloor.
     * Return the FIRST slot that is EITHER:
     *  1. Completely vacant (unbooked gap) AND not time-shadowed by a shifted patient.
     *  2. OR a designated Zipper position (rhythmic fallback).
     *
     * FIFO integrity is preserved emergently by QueueBubblingService (The Vacuum).
     */
    const zipperPositions = new Set<number>();
    if (walkInSpacing > 0) {
      const modulus = walkInSpacing + 1;
      for (let i = walkInSpacing; i < sessionSlots.length + 100; i += modulus) {
        zipperPositions.add(i);
      }
    }

    const targetSlot = sessionSlots.find(slot => {
      if (!isAfter(slot.time, now)) return false;
      if (slot.index <= hardFloor) return false;
      if (occupiedSlotIndices.has(slot.index)) return false;

      // 🚫 SHADOW-GAP GUARD: Reject slots whose raw session time is already
      // occupied by a shifted appointment's stored display time.
      // e.g. after a 1hr break, slot 1009 (raw 9:30 PM) conflicts with
      // Anju who shifted to 9:30 PM — even though slot 1009 has no DB doc.
      const rawSlotTimeStr = istFormatter.format(slot.time);
      if (occupiedTimeStrings.has(rawSlotTimeStr)) return false;

      if (zipperPositions.has(slot.index)) return true;
      return true;
    });

    if (targetSlot) {
      console.log(`[WalkInPlacement] CLASSIC: Greedy placement at slot ${targetSlot.index} (Zipper N=${walkInSpacing}, hardFloor=${hardFloor})`);
      return targetSlot;
    }

    console.warn('[WalkInPlacement] No classic slots available (Session full or all above floor).');
    return null;
  }
}
