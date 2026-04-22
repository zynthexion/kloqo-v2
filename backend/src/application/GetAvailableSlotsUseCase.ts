import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IConsultationCounterRepository } from '../domain/repositories';
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
  userLat?: number;
  userLon?: number;
}

export interface GetAvailableSlotsResponse {
  slots: DecoratedSlot[];
  isSessionActive: boolean;
  activeSessionIndex: number | null;
  distributionType: 'classic' | 'advanced';
  consultationCount: number;
}

/**
 * GetAvailableSlotsUseCase
 *
 * Returns all slots for a given doctor/date, decorated with availability status.
 * Delegates ALL session & break logic to BookingSessionEngine — the canonical
 * domain service that is the single source of truth across the monorepo.
 */
export class GetAvailableSlotsUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository,
    private consultationCounterRepo: IConsultationCounterRepository
  ) {}

  async execute(request: GetAvailableSlotsRequest): Promise<GetAvailableSlotsResponse> {
    let { clinicId, doctorId, date: dateStr, source = 'staff', userLat, userLon } = request;

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

    // ── 5.5 Location Check: Promote patient to walkin if nearby (150m) ───────
    if (source === 'patient' && typeof userLat === 'number' && typeof userLon === 'number' && doctor.latitude && doctor.longitude) {
      try {
        const { calculateDistance } = await import('@kloqo/shared-core/src/utils/location-utils');
        const distance = calculateDistance(userLat, userLon, doctor.latitude, doctor.longitude);
        if (distance <= 150) {
          console.log(`[Proximity] Patient is within ${Math.round(distance)}m. Unlocking walk-in slots.`);
          source = 'walkin';
        }
      } catch (e) {
        console.error('[Proximity] Failed to calculate distance:', e);
      }
    }

    // ── 6. Generate raw slots via SlotCalculator ──────────────────────────────
    const allSlots = SlotCalculator.generateSlots(doctor, requestedDate);
    if (allSlots.length === 0) {
      return {
        slots: [],
        isSessionActive: false,
        activeSessionIndex: null,
        distributionType: (doctor.tokenDistribution || clinic.tokenDistribution || 'advanced') as 'classic' | 'advanced',
        consultationCount: 0
      };
    }

    // ── 7. Decorate via BookingSessionEngine — single source of truth ─────────
    const reserveRatio = doctor.walkInReserveRatio ?? clinic.walkInReserveRatio ?? 0.15;
    const distributionType = (doctor.tokenDistribution || clinic.tokenDistribution || 'advanced') as 'classic' | 'advanced';
    
    const decoratedSlots = BookingSessionEngine.decorateSlots(
      allSlots,
      bookedMap,
      breakSlotIndices,
      now,
      source,
      reserveRatio,
      distributionType,
      doctor.walkInTokenAllotment || 5
    );

    // ── 7.5. Calculate Active Session Flag (for Today only) ──────────────────
    let isSessionActive = false;
    let activeSessionIndex: number | null = null;
    
    if (isSameDay(requestedDate, todayBaselineIst)) {
      activeSessionIndex = BookingSessionEngine.findActiveSession(
        doctor,
        allSlots,
        appointments,
        now,
        distributionType
      );
      isSessionActive = activeSessionIndex !== null;
    }
    
    // ── 7.7 Fetch Consultation Count (Rule 14 parity) ────────────────────────
    let consultationCount = 0;
    if (activeSessionIndex !== null) {
      consultationCount = await this.consultationCounterRepo.getCount(
        clinicId,
        doctorId,
        firestoreDateStr,
        activeSessionIndex
      );
    }

    // ── 8. Staff Parity: Enforce "Next Available Only" per Session ────────────
    if (source === 'staff') {
      const filteredSlots: DecoratedSlot[] = [];
      const sessionMap = new Set<number>();
      for (const slot of decoratedSlots) {
         if (slot.status === 'available' && slot.isAvailable && !sessionMap.has(slot.sessionIndex)) {
             filteredSlots.push(slot);
             sessionMap.add(slot.sessionIndex);
         }
      }
      return {
        slots: filteredSlots,
        isSessionActive,
        activeSessionIndex,
        distributionType,
        consultationCount
      };
    }

    return {
      slots: decoratedSlots,
      isSessionActive,
      activeSessionIndex,
      distributionType,
      consultationCount
    };
  }
}
