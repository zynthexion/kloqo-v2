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
    isPriority: boolean = false
  ): DailySlot | null {
    const ACTIVE_STATUSES = new Set(['Pending', 'Confirmed', 'Skipped', 'Completed']);

    // Build set of occupied slot indices from active appointments
    const occupiedSlotIndices = new Set<number>(
      appointments
        .filter(a => ACTIVE_STATUSES.has(a.status) && typeof a.slotIndex === 'number')
        .map(a => a.slotIndex!)
    );

    // 🚑 PRIORITY TRIAGE (PW-Token Logic)
    // If priority, we bypass ALL rhythmic/buffer constraints and take the first physical gap.
    if (isPriority) {
      const bubbleGap = sessionSlots.find(slot =>
        !occupiedSlotIndices.has(slot.index) &&
        isAfter(slot.time, now)
      );
      if (bubbleGap) {
        console.log(`[WalkInPlacement] PRIORITY: Injecting PW-Token into first physical gap at slot ${bubbleGap.index}`);
        return bubbleGap;
      }
    }

    if (mode === 'advanced') {
      return this._findAdvancedSlot(sessionSlots, occupiedSlotIndices, now);
    } else {
      return this._findClassicSlot(sessionSlots, occupiedSlotIndices, now, walkInSpacing);
    }
  }

  // ── Advanced Mode: Smart Bubble → Buffer Slot ─────────────────────────────

  private static _findAdvancedSlot(
    sessionSlots: DailySlot[],
    occupiedSlotIndices: Set<number>,
    now: Date
  ): DailySlot | null {
    // PHASE A: Smart Bubble (60-minute window)
    const oneHourFromNow = addMinutes(now, 60);
    const bubbleGap = sessionSlots.find(slot =>
      !occupiedSlotIndices.has(slot.index) &&
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
    now: Date,
    walkInSpacing: number
  ): DailySlot | null {
    /**
     * PURE GREED STRATEGY:
     * Scan every slot chronologically after 'now'.
     * Return the FIRST slot that is EITHER:
     *  1. Completely vacant (unbooked gap).
     *  2. OR a designated Zipper position (rhythmic fallback).
     * 
     * FIFO integrity is preserved emergentlly by QueueBubblingService (The Vacuum).
     */
    const zipperPositions = new Set<number>();
    if (walkInSpacing > 0) {
      // spacing=4 means every 5th slot is a zipper (indices 4, 9, 14...)
      const modulus = walkInSpacing + 1;
      for (let i = walkInSpacing; i < sessionSlots.length + 100; i += modulus) {
        zipperPositions.add(i);
      }
    }

    const targetSlot = sessionSlots.find(slot => {
      // Must be in the future
      if (!isAfter(slot.time, now)) return false;

      // Must not be occupied by an active appointment
      if (occupiedSlotIndices.has(slot.index)) return false;

      // Rule A: It's a reserved Zipper spot
      if (zipperPositions.has(slot.index)) return true;

      // Rule B: It's an unbooked empty gap (Greedy Front-Fill)
      // Since it's not occupied (checked above), it's a valid target.
      return true;
    });

    if (targetSlot) {
      console.log(`[WalkInPlacement] CLASSIC: Greedy placement at slot ${targetSlot.index} (Zipper N=${walkInSpacing})`);
      return targetSlot;
    }

    console.warn('[WalkInPlacement] No classic slots available (Session full).');
    return null;
  }
}
