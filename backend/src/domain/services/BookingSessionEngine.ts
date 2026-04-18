import { addMinutes, differenceInMinutes, isAfter, isBefore, subMinutes } from 'date-fns';
import { getClinicISOString } from './DateUtils';
import type { Doctor, Appointment } from '../../../../packages/shared/src/index';
import type { DailySlot } from './SlotCalculator';

// ─── Constants ─────────────────────────────────────────────────────────────────
const ONGOING_STATUSES = new Set(['Pending', 'Confirmed', 'Skipped']);

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Who is requesting the slots.
 * Determines the booking buffer applied:
 *   patient  → 30 minutes (industry standard for travel time)
 *   staff    → 15 minutes (nurses / admins book for patients already present)
 *   internal → 0 minutes  (system operations, no user-facing buffer)
 */
export type SlotSource = 'patient' | 'staff' | 'internal';

/** How a slot should appear to the requester. */
export type SlotStatus = 'available' | 'booked' | 'reserved' | 'past' | 'blocked' | 'break';

/** Information about a single displayable slot. */
export interface DecoratedSlot {
  time: string;         // ISO string
  slotIndex: number;
  sessionIndex: number;
  isAvailable: boolean;
  status: SlotStatus;
  /** Only set for staff sources — exposes why a slot is blocked (e.g. 'Break: Lunch'). */
  reason?: string;
}

// ─── BookingSessionEngine ───────────────────────────────────────────────────────

/**
 * BookingSessionEngine
 *
 * Single source of truth for ALL booking session logic across the monorepo.
 * Ported from the battle-tested legacy walk-in.service.ts (shared-core).
 *
 * Responsibilities:
 *  1. findActiveSession       — Which session is accepting W-tokens right now?
 *  2. getBookingBuffer        — How many minutes buffer for a given source?
 *  3. calculateReserved       — Last 15% of each session reserved for walk-ins.
 *  4. decorateSlots           — Apply all rules and return the final slot list.
 */
export class BookingSessionEngine {

  // ── 1. Booking Buffer ───────────────────────────────────────────────────────

  /**
   * Returns the booking buffer in minutes based on who is making the request.
   * - patient  → 30 min  (travel + prep time guarantee)
   * - staff    → 15 min  (patient is already at the clinic)
   * - internal → 0 min   (system-generated, no UX buffer needed)
   */
  static getBookingBuffer(source: SlotSource): number {
    switch (source) {
      case 'patient':  return 45;
      case 'staff':    return 30;
      case 'internal': return 0;
    }
  }

  // ── 2. Active Session Discovery (for W-tokens) ──────────────────────────────

  /**
   * Finds the currently active session index for walk-in token assignment.
   *
   * Classic distribution — "Sticky + Jumping" logic (legacy-port):
   *   • Session stays sticky for up to 30 minutes past its end if:
   *       - Doctor's consultationStatus === 'In' AND/OR
   *       - There are still pending/confirmed appointments in that session.
   *   • Hard cap of 90 minutes past session end to prevent runaway overtime.
   *   • Large-gap aware: if next session starts >60m after current session ends,
   *     we stay sticky longer (up to 90m) before jumping.
   *   • Small-gap: jump immediately when the previous session formally ends.
   *
   * Advanced distribution:
   *   • Strict 30-minute pre-start window. Session becomes active 30m before
   *     its first slot and remains active until its last slot.
   *
   * @returns The active session index, or null if no session is currently active.
   */
  static findActiveSession(
    doctor: Doctor,
    allSlots: DailySlot[],
    appointments: Appointment[],
    now: Date,
    tokenDistribution: 'classic' | 'advanced' = 'advanced'
  ): number | null {
    if (allSlots.length === 0) return 0;
    const isClassic = tokenDistribution === 'classic';

    // Build session ranges from the slot list
    const sessionMap = new Map<number, { idx: number; start: Date; end: Date }>();
    allSlots.forEach(s => {
      const current = sessionMap.get(s.sessionIndex);
      if (!current) {
        sessionMap.set(s.sessionIndex, { idx: s.sessionIndex, start: s.time, end: s.time });
      } else {
        if (isBefore(s.time, current.start)) current.start = s.time;
        if (isAfter(s.time, current.end))   current.end   = s.time;
      }
    });

    const sessionRanges = Array.from(sessionMap.values()).sort((a, b) => a.idx - b.idx);

    for (let i = 0; i < sessionRanges.length; i++) {
      const session     = sessionRanges[i];
      const nextSession = sessionRanges[i + 1];

      if (isClassic) {
        // ── Rule: For Session 0, it is always open while `now < session.end` ──
        if (i === 0 && isBefore(now, session.end)) {
          return session.idx;
        }

        // ── Sticky logic ────────────────────────────────────────────────────
        const hasOngoingAppts = appointments.some(
          a => a.sessionIndex === session.idx && ONGOING_STATUSES.has(a.status)
        );
        const isDocIn = doctor.consultationStatus === 'In';

        // 30-minute grace period cap (prevents infinite sticky)
        const stickyGraceLimit   = addMinutes(session.end, 30);
        const isDocInWithGrace   = isDocIn && isBefore(now, stickyGraceLimit);
        const hasOngoingWithGrace = hasOngoingAppts && isBefore(now, stickyGraceLimit);

        const isStickyCandidate =
          isAfter(now, session.end) && (hasOngoingWithGrace || isDocInWithGrace);

        if (isStickyCandidate) {
          if (nextSession) {
            const gap = differenceInMinutes(nextSession.start, session.end);
            if (gap > 60) {
              // Large gap: stay sticky but hard-cap at 90 min past session end
              const minutesPastEnd = differenceInMinutes(now, session.end);
              if (isBefore(now, subMinutes(nextSession.start, 30)) && minutesPastEnd < 90) {
                return session.idx;
              }
              // After 90 min, fall through to next session check
            }
            // Small gap: fall through — jump immediately
          } else {
            // Last session: stays sticky as long as active
            return session.idx;
          }
        }

        // ── Opening subsequent sessions (S1+) ────────────────────────────────
        if (i > 0) {
          const prevSession    = sessionRanges[i - 1];
          const gapWithPrev    = differenceInMinutes(session.start, prevSession.end);

          if (gapWithPrev > 60) {
            // Large gap: open only when previous session is done OR 30m fail-safe
            const isPrevDone =
              !appointments.some(
                a => a.sessionIndex === prevSession.idx && ONGOING_STATUSES.has(a.status)
              ) && doctor.consultationStatus === 'Out';
            const isFailSafe = !isBefore(now, subMinutes(session.start, 30));
            if ((isPrevDone || isFailSafe) && !isAfter(now, session.end)) {
              return session.idx;
            }
          } else {
            // Small gap: jump immediately when previous formally ends
            if (!isBefore(now, prevSession.end) && !isAfter(now, session.end)) {
              return session.idx;
            }
          }
        }
      } else {
        // ── Advanced distribution: strict 30-minute pre-start window ─────────
        const windowStart = subMinutes(session.start, 30);
        if (!isAfter(now, session.end) && !isBefore(now, windowStart)) {
          return session.idx;
        }
      }
    }

    return null; // No active session found
  }

  // ── 3. Walk-in Reserved Slots (85/15 Rule) ──────────────────────────────────

  /**
   * Calculates the last 15% of FUTURE slots in each session as reserved for walk-ins.
   * ⚠️ This is recalculated dynamically — as time passes the reserved set shrinks.
   */
  static calculateReservedSlots(slots: DailySlot[], now: Date): Set<number> {
    const reservedSlots = new Set<number>();
    const slotsBySession = new Map<number, DailySlot[]>();

    slots.forEach(slot => {
      const list = slotsBySession.get(slot.sessionIndex) ?? [];
      list.push(slot);
      slotsBySession.set(slot.sessionIndex, list);
    });

    slotsBySession.forEach(sessionSlots => {
      sessionSlots.sort((a, b) => a.index - b.index);
      const futureSlots = sessionSlots.filter(s => s.time.getTime() >= now.getTime());
      if (futureSlots.length === 0) return;

      const reserveCount  = Math.ceil(futureSlots.length * 0.15);
      const reserveStart  = futureSlots.length - reserveCount;
      for (let i = reserveStart; i < futureSlots.length; i++) {
        reservedSlots.add(futureSlots[i].index);
      }
    });

    return reservedSlots;
  }

  // ── 4. Slot Decoration ──────────────────────────────────────────────────────

  /**
   * Applies all business rules and returns a decorated slot list ready for
   * the API response. This is the canonical implementation used by ALL apps.
   *
   * Rules applied (in priority order):
   *  A. Past / Buffer check  → status: 'past'
   *  B. Booked check         → status: 'booked'
   *  C. Break check          → status: 'break' (staff) or 'booked' (patient, hidden)
   *  D. Reserved check       → status: 'reserved'
   *  E. First Available rule → Only the first unblocked slot per session is 'available';
   *                            all others are 'blocked'.
   *
   * @param source   Controls buffer minutes and break label visibility.
   */
  static decorateSlots(
    allSlots: DailySlot[],
    bookedMap: Map<number, string>,      // slotIndex → tokenNumber
    breakSlotIndices: Set<number>,       // slot indices blocked by breaks
    now: Date,
    source: SlotSource
  ): DecoratedSlot[] {
    const isToday    = getClinicISOString(now) === (allSlots[0] ? getClinicISOString(allSlots[0].time) : '');
    const bufferMins = this.getBookingBuffer(source);
    const cutoff    = addMinutes(now, bufferMins);
    const reserved  = this.calculateReservedSlots(allSlots, now);

    // Pre-pass: find the first truly available slot per session
    const firstAvailablePerSession = new Map<number, number>(); // sessionIndex → slotIndex
    for (const slot of allSlots) {
      if (firstAvailablePerSession.has(slot.sessionIndex)) continue;
      const isPast     = isToday && isAfter(cutoff, slot.time);
      const isBooked   = bookedMap.has(slot.index);
      const isBreak    = breakSlotIndices.has(slot.index);
      const isReserved = reserved.has(slot.index);
      if (!isPast && !isBooked && !isBreak && !isReserved) {
        firstAvailablePerSession.set(slot.sessionIndex, slot.index);
      }
    }

    return allSlots.map(slot => {
      const timeStr = slot.time.toISOString();
      const base    = { time: timeStr, slotIndex: slot.index, sessionIndex: slot.sessionIndex };

      // A. Past / buffer
      if (isToday && isAfter(cutoff, slot.time)) {
        return { ...base, isAvailable: false, status: 'past' as SlotStatus };
      }

      // B. Booked
      if (bookedMap.has(slot.index)) {
        return { ...base, isAvailable: false, status: 'booked' as SlotStatus };
      }

      // C. Break
      if (breakSlotIndices.has(slot.index)) {
        // Staff sees the reason; patients just see an unavailable slot
        if (source === 'staff') {
          return { ...base, isAvailable: false, status: 'break' as SlotStatus, reason: 'Break' };
        }
        // For patients, treat breaks as booked — invisible reason
        return { ...base, isAvailable: false, status: 'booked' as SlotStatus };
      }

      // D. Reserved for walk-ins
      if (reserved.has(slot.index)) {
        return { ...base, isAvailable: false, status: 'reserved' as SlotStatus };
      }

      // E. First Available rule
      const isFirst = firstAvailablePerSession.get(slot.sessionIndex) === slot.index;
      return {
        ...base,
        isAvailable: isFirst,
        status: (isFirst ? 'available' : 'blocked') as SlotStatus,
      };
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** True if two dates fall on the same clinic day (IST). */
  private static _isSameClinicDay(a: Date, b: Date): boolean {
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', dateStyle: 'short' }).format(d);
    return fmt(a) === fmt(b);
  }
}
