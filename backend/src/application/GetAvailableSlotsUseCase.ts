import { IAppointmentRepository, IDoctorRepository, IClinicRepository } from '../domain/repositories';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { BookingSessionEngine, type SlotSource, type DecoratedSlot } from '../domain/services/BookingSessionEngine';
import { 
  getClinicNow, 
  parseClinicDate, 
  getClinicDateString,
  getClinicISOString,
  addDays,
  isSameDay, 
  isAfter,
} from '../domain/services/DateUtils';

export interface GetAvailableSlotsRequest {
  clinicId: string;
  doctorId: string;
  date: string; // ISO format "yyyy-MM-dd" OR legacy "d MMMM yyyy"
  /**
   * Who is requesting the slots — controls the booking buffer applied.
   *  'staff'   → 15-minute buffer  (nurse / clinic admin)
   *  'patient' → 30-minute buffer  (patient must factor in travel time)
   *  'internal'→ 0-minute buffer   (system-generated, no UX buffer)
   * Defaults to 'staff' if not provided so existing staff routes are unaffected.
   */
  source?: SlotSource;
}

// Re-export so controller/routes importing from here still work
export type { DecoratedSlot as AvailableSlotInfo };

/**
 * GetAvailableSlotsUseCase
 *
 * Returns all slots for a given doctor/date, decorated with availability status.
 * Delegates ALL session & break logic to BookingSessionEngine — the canonical
 * domain service that is the single source of truth across the monorepo.
 *
 * Key design decisions:
 *  • source param drives the buffer (patient 30m / staff 15m)
 *  • Breaks are fetched via the appointment repo (Blocked appointments)
 *    — this is safer than legacy offset math and treats breaks as immutable objects
 *  • First Available rule: only the earliest unblocked slot per session is
 *    marked 'available'. This forces density without hiding future sessions.
 *  • Staff see breaks as status:'break'; patients see them as status:'booked'
 *  • Rule 8 / 14: advance-booking window enforced; past-date guard applied.
 */
export class GetAvailableSlotsUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository
  ) {}

  async execute(request: GetAvailableSlotsRequest): Promise<DecoratedSlot[]> {
    const { clinicId, doctorId, date: dateStr, source = 'staff' } = request;

    // ── 1. Fetch doctor and enforce tenant isolation (Rule 15) ──────────────
    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor) throw new Error('Doctor not found');
    if (doctor.clinicId !== clinicId) {
      console.error(
        `[SECURITY] Tenant violation: Clinic ${clinicId} tried to access Doctor ${doctorId} (Clinic ${doctor.clinicId})`
      );
      throw new Error('Unauthorized access to doctor resources');
    }

    // ── 2. Date parsing & guard rails (Rules 8 & 14) ─────────────────────────
    const now              = getClinicNow();
    const todayStrIst      = getClinicISOString(now);
    const todayBaselineIst = parseClinicDate(todayStrIst);

    // Accept both "yyyy-MM-dd" and legacy "d MMMM yyyy"
    let requestedDate: Date;
    if (dateStr.includes('-')) {
      requestedDate = parseClinicDate(dateStr);
    } else {
      // Legacy "d MMMM yyyy" — parse via date manipulation
      try {
        const { parse } = await import('date-fns');
        // IMPORTANT: Use todayBaselineIst (00:00:00) as the reference to avoid inheriting current time!
        requestedDate = parse(dateStr, 'd MMMM yyyy', todayBaselineIst);
      } catch {
        requestedDate = new Date(dateStr);
        requestedDate.setHours(0, 0, 0, 0);
      }
    }

    if (isNaN(requestedDate.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    if (requestedDate < todayBaselineIst) {
      throw new Error('Cannot retrieve slots for past dates');
    }

    const advanceBookingDays = doctor.advanceBookingDays ?? 7;
    const cutoffDate         = addDays(todayBaselineIst, advanceBookingDays);
    if (isAfter(requestedDate, cutoffDate)) {
      throw new Error(
        `Booking window exceeded. Slots available up to ${advanceBookingDays} days in advance.`
      );
    }

    const clinic = await this.clinicRepo.findById(clinicId);
    if (!clinic) throw new Error('Clinic not found');

    // ── 3. Fetch existing appointments for this doctor/date ──────────────────
    const firestoreDateStr = getClinicDateString(requestedDate);
    const appointments     = await this.appointmentRepo.findByDoctorAndDate(
      doctorId, 
      firestoreDateStr
    );

    // ── 4. Build booked slot index map ────────────────────────────────────────
    //    Any appointment in an active status occupies a slot.
    const bookedMap = new Map<number, string>();
    appointments.forEach(a => {
      if (['Pending', 'Confirmed', 'Completed', 'Attended'].includes(a.status)) {
        if (typeof a.slotIndex === 'number') {
          bookedMap.set(a.slotIndex, a.tokenNumber ?? 'BOOKED');
        }
      }
    });

    // ── 5. Build break slot index set ─────────────────────────────────────────
    //    Breaks are modelled as appointments with bookedVia === 'BreakBlock'
    //    (or cancelledByBreak === true on the blocked patient appointment).
    //    We expose the raw reason label only to staff consumers.
    const breakSlotIndices = new Set<number>();
    appointments.forEach(a => {
      if (
        a.bookedVia === 'BreakBlock' 
        || (a as any).cancelledByBreak === true
        || a.status === 'Blocked'
      ) {
        if (typeof a.slotIndex === 'number') {
          breakSlotIndices.add(a.slotIndex);
          // Remove from booked map — breaks are handled separately for label clarity
          bookedMap.delete(a.slotIndex);
        }
      }
    });

    // ── 6. Generate raw slots via SlotCalculator ──────────────────────────────
    const allSlots = SlotCalculator.generateSlots(doctor, requestedDate);
    if (allSlots.length === 0) return [];

    // ── 7. Decorate via BookingSessionEngine — single source of truth ─────────
    const decoratedSlots = BookingSessionEngine.decorateSlots(
      allSlots,
      bookedMap,
      breakSlotIndices,
      now,
      source
    );

    // ── 8. Staff Parity: Enforce "Next Available Only" per Session ────────────
    // Walk-ins handled via separate endpoint. Staff Advanced Booking only
    // ever needs the single next available slot per session.
    if (source === 'staff') {
      const filteredSlots: DecoratedSlot[] = [];
      const sessionMap = new Set<number>();
      for (const slot of decoratedSlots) {
         if (slot.status === 'available' && slot.isAvailable && !sessionMap.has(slot.sessionIndex)) {
             filteredSlots.push(slot);
             sessionMap.add(slot.sessionIndex);
         }
      }
      return filteredSlots;
    }

    return decoratedSlots;
  }
}
