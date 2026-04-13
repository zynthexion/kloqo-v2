import { IAppointmentRepository, IDoctorRepository, IClinicRepository } from '../domain/repositories';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { 
  getClinicNow, 
  parseClinicDate, 
  getClinicDateString,
  getClinicISOString,
  addDays,
  isSameDay, 
  isAfter,
  addMinutes
} from '../domain/services/DateUtils';

export interface GetAvailableSlotsRequest {
  clinicId: string;
  doctorId: string;
  date: string; // ISO format "yyyy-MM-dd"
}

export interface AvailableSlotInfo {
  time: string; // ISO string
  slotIndex: number;
  sessionIndex: number;
  isAvailable: boolean;
  status: 'available' | 'booked' | 'leave' | 'reserved' | 'past' | 'blocked';
  reason?: string;
  tokenNumber?: string;
}

/**
 * GetAvailableSlotsUseCase
 * 
 * Principal Engineer Refactor:
 * - Direct Date Translation: yyyy-MM-dd -> d MMMM yyyy (Firestore compat)
 * - Strict Tenant Isolation (Rule 15)
 * - Orchestration of SlotCalculator and Appointment matching
 * - Advance Booking Window Enforcement (Rule 8 & 14)
 */
export class GetAvailableSlotsUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository
  ) {}

  async execute(request: GetAvailableSlotsRequest): Promise<AvailableSlotInfo[]> {
    const { clinicId, doctorId, date: dateStr } = request;

    // 1. Fetch Doctor and Verify Tenant Isolation (Rule 15)
    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor) throw new Error('Doctor not found');
    
    if (doctor.clinicId !== clinicId) {
      console.error(`[SECURITY] Tenant violation attempt: Clinic ${clinicId} tried to access Doctor ${doctorId} (Clinic ${doctor.clinicId})`);
      throw new Error('Unauthorized access to doctor resources');
    }

    // 2. Advance Booking Window Enforcement (Rule 8 & 14)
    const now = getClinicNow();
    const todayStrIst = getClinicISOString(now); // yyyy-MM-dd
    const todayBaselineIst = parseClinicDate(todayStrIst); // Midnight IST of "Today"
    
    const requestedDate = parseClinicDate(dateStr);
    if (isNaN(requestedDate.getTime())) throw new Error(`Invalid date format: ${dateStr}`);

    // Past Date Guard
    if (requestedDate < todayBaselineIst) {
      throw new Error('Cannot book for past dates');
    }

    // Future Window Guard (Standardized to ?? 7 as per enterprise default)
    const advanceBookingDays = doctor.advanceBookingDays ?? 7;
    const cutoffDate = addDays(todayBaselineIst, advanceBookingDays);

    if (isAfter(requestedDate, cutoffDate)) {
      throw new Error(`Booking window exceeded. Appointments can only be booked up to ${advanceBookingDays} days in advance (Cutoff: ${getClinicDateString(cutoffDate)}).`);
    }

    const clinic = await this.clinicRepo.findById(clinicId);
    if (!clinic) throw new Error('Clinic not found');

    // 3. Date Translation (Rule 8)
    // Convert to Firestore standard string for appointment lookup
    const firestoreDateStr = getClinicDateString(requestedDate);

    // 3. Fetch Data for Orchestration
    const appointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, firestoreDateStr);
    
    // Map existing appointments to slot indices for fast lookup
    const bookedSlotIndices = new Map<number, string>();
    appointments.forEach(a => {
      // Rule: Any status that occupies a slot blocks further booking
      if (['Pending', 'Confirmed', 'Completed', 'Attended'].includes(a.status)) {
        bookedSlotIndices.set(a.slotIndex!, a.tokenNumber || 'BOOKED');
      }
    });

    // 4. Generate Raw Slots via Domain Service
    const allSlots = SlotCalculator.generateSlots(doctor, requestedDate);
    
    // 5. Apply Business Rules & Decoration
    const isToday = isSameDay(requestedDate, now);
    
    // Rule: 30-minute buffer for same-day advanced bookings
    const bookingBuffer = addMinutes(now, 15); 

    // Rule: Check for reserved capacity (15% for walk-ins in Advanced mode)
    const reservedForWalkIn = SlotCalculator.calculatePerSessionReservedSlots(allSlots, isToday ? now : requestedDate);

    // 6. "First Available" Optimization Rule
    // Business Requirement: Show only the chronologically first 'available' slot per session.
    // This forces patients to fill the earliest gaps first.
    const firstAvailableIndices = new Set<number>();
    const sessionMap = new Map<number, boolean>(); // Track if an available slot was found for a session

    allSlots.forEach(slot => {
      if (!sessionMap.has(slot.sessionIndex)) {
        const isActuallyBooked = bookedSlotIndices.has(slot.index);
        const isReserved = reservedForWalkIn.has(slot.index);
        const isPast = isToday && isAfter(bookingBuffer, slot.time);

        if (!isActuallyBooked && !isReserved && !isPast) {
          firstAvailableIndices.add(slot.index);
          sessionMap.set(slot.sessionIndex, true);
        }
      }
    });

    return allSlots.map(slot => {
      const timeStr = slot.time.toISOString();
      const bookedToken = bookedSlotIndices.get(slot.index);
      
      // A. Past Check
      if (isToday && isAfter(bookingBuffer, slot.time)) {
        return {
          time: timeStr, slotIndex: slot.index, sessionIndex: slot.sessionIndex, isAvailable: false, status: 'past'
        };
      }

      // B. Booked Check
      if (bookedToken) {
        return {
          time: timeStr, slotIndex: slot.index, sessionIndex: slot.sessionIndex, isAvailable: false, status: 'booked',
          // 🔒 SCR-01 Anti-Scraping: Never leak token numbers to the public discovery API
          tokenNumber: undefined 
        };
      }

      // C. Reserved Check (85/15 Rule)
      if (reservedForWalkIn.has(slot.index)) {
        return {
          time: timeStr, slotIndex: slot.index, sessionIndex: slot.sessionIndex, isAvailable: false, status: 'reserved'
        };
      }

      // D. "First Available" Check
      // If it's not the first available, we mark as 'blocked'
      const isFirst = firstAvailableIndices.has(slot.index);

      return {
        time: timeStr,
        slotIndex: slot.index,
        sessionIndex: slot.sessionIndex,
        isAvailable: isFirst,
        status: isFirst ? 'available' : 'blocked'
      } as AvailableSlotInfo;
    });
  }
}
