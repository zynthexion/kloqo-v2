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
    walkInSpacing: number
  ): DailySlot | null {
    const ACTIVE_STATUSES = new Set(['Pending', 'Confirmed', 'Skipped', 'Completed']);

    // Build set of occupied slot indices from active appointments
    const occupiedSlotIndices = new Set<number>(
      appointments
        .filter(a => ACTIVE_STATUSES.has(a.status) && typeof a.slotIndex === 'number')
        .map(a => a.slotIndex!)
    );

    if (mode === 'advanced') {
      return this._findAdvancedSlot(sessionSlots, occupiedSlotIndices, now);
    } else {
      return this._findClassicSlot(sessionSlots, appointments, occupiedSlotIndices, now, walkInSpacing);
    }
  }

  // ── Advanced Mode: Smart Bubble → Buffer Slot ─────────────────────────────

  private static _findAdvancedSlot(
    sessionSlots: DailySlot[],
    occupiedSlotIndices: Set<number>,
    now: Date
  ): DailySlot | null {
    // PHASE A: Smart Bubble (60-minute window)
    // Scan for a cancelled/empty gap in the next 60 minutes.
    // These are slots that exist in the schedule but have no active appointment.
    const oneHourFromNow = addMinutes(now, 60);
    const bubbleGap = sessionSlots.find(slot =>
      !occupiedSlotIndices.has(slot.index) &&
      !isAfter(slot.time, oneHourFromNow) &&
      isAfter(slot.time, now)
    );

    if (bubbleGap) {
      console.log(`[WalkInPlacement] PHASE A: Bubbling walk-in into gap at slot ${bubbleGap.index} (${bubbleGap.time.toISOString()})`);
      return bubbleGap;
    }

    // PHASE B: Buffer Slot Assignment
    // Use the 15% reserved buffer. Find the first empty slot in the reserved set.
    const reservedSlotIndices = BookingSessionEngine.calculateReservedSlots(sessionSlots, now);

    const bufferSlot = sessionSlots.find(slot =>
      reservedSlotIndices.has(slot.index) &&
      !occupiedSlotIndices.has(slot.index) &&
      isAfter(slot.time, now)
    );

    if (bufferSlot) {
      console.log(`[WalkInPlacement] PHASE B: Assigning walk-in to buffer slot ${bufferSlot.index} (${bufferSlot.time.toISOString()})`);
      return bufferSlot;
    }

    console.warn('[WalkInPlacement] No advanced slots available: all buffer & gap slots occupied.');
    return null;
  }

  // ── Classic Mode: Linear 1:N Interval ─────────────────────────────────────

  private static _findClassicSlot(
    sessionSlots: DailySlot[],
    appointments: Appointment[],
    occupiedSlotIndices: Set<number>,
    now: Date,
    walkInSpacing: number
  ): DailySlot | null {
    const ACTIVE_STATUSES = new Set(['Pending', 'Confirmed', 'Skipped', 'Completed']);

    // Sort existing walk-ins and A-tokens for interval math
    const activeAppts = appointments
      .filter(a => ACTIVE_STATUSES.has(a.status) && typeof a.slotIndex === 'number')
      .sort((a, b) => a.slotIndex! - b.slotIndex!);

    const walkIns = activeAppts.filter(a => a.bookedVia === 'Walk-in');
    const aTokens = activeAppts.filter(a => a.bookedVia !== 'Walk-in');

    const lastWalkInIndex = walkIns.length > 0
      ? Math.max(...walkIns.map(a => a.slotIndex!))
      : -1;

    // Find the Nth A-Token after the last walk-in anchor
    let minTargetIndex = -1;
    if (walkInSpacing > 0 && aTokens.length > 0) {
      const aTokensAfterLastWalkIn = aTokens.filter(a => a.slotIndex! > lastWalkInIndex);

      if (aTokensAfterLastWalkIn.length >= walkInSpacing) {
        const nthAToken = aTokensAfterLastWalkIn[walkInSpacing - 1];
        minTargetIndex = nthAToken.slotIndex!;
      } else {
        // Not enough A-Tokens for spacing; place after the last active slot
        const lastActiveIndex = activeAppts[activeAppts.length - 1]?.slotIndex ?? -1;
        minTargetIndex = Math.max(lastWalkInIndex, lastActiveIndex);
      }
    } else {
      // No spacing configured: place sequentially after last walk-in
      minTargetIndex = lastWalkInIndex;
    }

    // Find the first available slot after the calculated minimum target
    const targetSlot = sessionSlots.find(slot =>
      slot.index > minTargetIndex &&
      !occupiedSlotIndices.has(slot.index) &&
      isAfter(slot.time, now)
    );

    if (targetSlot) {
      console.log(`[WalkInPlacement] CLASSIC: Placing walk-in at slot ${targetSlot.index} (after ${walkInSpacing} A-token spacing)`);
      return targetSlot;
    }

    console.warn('[WalkInPlacement] No classic slots available after spacing constraint.');
    return null;
  }
}
