import { Appointment } from '../../../packages/shared/src/index';
import {
  IAppointmentRepository,
  IDoctorRepository,
  IClinicRepository,
  ITransaction
} from '../domain/repositories';
import { ManagePatientUseCase } from './ManagePatientUseCase';
import { format } from 'date-fns';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { BookingSessionEngine } from '../domain/services/BookingSessionEngine';
import { WalkInPlacementService } from '../domain/services/WalkInPlacementService';
import { TokenGeneratorService } from '../domain/services/token/TokenGeneratorService';
import { sseService } from '../domain/services/SSEService';
import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';
import { getClinicNow, getClinicDateString } from '../domain/services/DateUtils';
import { parse } from 'date-fns';

export interface CreateWalkInAppointmentDTO {
  clinicId: string;
  doctorId: string;
  patientName: string;
  age?: number;
  place: string;
  sex: 'Male' | 'Female' | 'Other';
  phone?: string;
  communicationPhone?: string;
  phoneDisabled?: boolean;
  patientId?: string;
  date: string; // d MMMM yyyy
  isForceBooked?: boolean; // Nurse-only: bypass capacity cap
  isPriority?: boolean; // Triage cases (PW-Tokens)
}

export class CreateWalkInAppointmentUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository,
    private managePatientUseCase: ManagePatientUseCase,
    private tokenGenerator: TokenGeneratorService
  ) {}

  async execute(dto: CreateWalkInAppointmentDTO): Promise<Appointment> {
    // ── FAIL FAST: Validate domain objects before any operations ──────────────
    const doctor = await this.doctorRepo.findById(dto.doctorId);
    if (!doctor) throw new Error('Doctor not found');

    const clinic = await this.clinicRepo.findById(dto.clinicId);
    if (!clinic) throw new Error('Clinic not found');

    const tokenDistribution = (clinic.tokenDistribution || 'advanced') as 'classic' | 'advanced';
    const walkInSpacing = clinic.walkInTokenAllotment || 0;

    // Parse the date string to a Date object for slot generation
    const requestedDate = dto.date.includes('-')
      ? parse(dto.date, 'yyyy-MM-dd', new Date())
      : parse(dto.date, 'd MMMM yyyy', new Date());

    const firestoreDateStr = getClinicDateString(requestedDate);

    // Pre-compute all slots (pure, no I/O) — safe to do outside the transaction
    const allSlots = SlotCalculator.generateSlots(doctor, requestedDate);

    // ── PATIENT MANAGEMENT ────────────────────────────────────────────────────
    // Runs its own internal transaction. Must be outside the main booking
    // transaction to avoid Firestore read-after-write conflicts.
    const normalizedPhone = dto.phone
      ? dto.phone.replace(/\D/g, '').slice(-10)
      : '';

    const patientId = await this.managePatientUseCase.execute({
      id: dto.patientId,
      name: dto.patientName,
      phone: normalizedPhone,
      communicationPhone: dto.communicationPhone,
      age: dto.age,
      sex: dto.sex,
      place: dto.place,
      clinicId: dto.clinicId,
    });

    // ── MAIN BOOKING TRANSACTION ──────────────────────────────────────────────
    // All reads, compute, and writes are inside one atomic block.
    // Firestore will automatically retry this on read-invalidation, meaning
    // if two nurses click at the same moment, one will retry and seamlessly
    // find the next available slot without a 409 error.
    const result = await db.runTransaction(async (txn) => {
      const now = getClinicNow();

      // 1. READ PATH (inside transaction — acquires Firestore read locks)
      const allAppointments = await this.appointmentRepo.findByDoctorAndDate(
        dto.doctorId,
        firestoreDateStr
      );

      // 2. ACTIVE SESSION DISCOVERY
      const activeSessionIndex = BookingSessionEngine.findActiveSession(
        doctor,
        allSlots,
        allAppointments,
        now,
        tokenDistribution
      );

      if (activeSessionIndex === null) {
        throw new Error('No active session found. Walk-in booking is not available at this time.');
      }

      const sessionSlots = allSlots.filter(s => s.sessionIndex === activeSessionIndex);
      const sessionAppointments = allAppointments.filter(a => a.sessionIndex === activeSessionIndex);

      // 3. COMPUTE PATH (inside transaction — uses the locked read data)
      const targetSlot = WalkInPlacementService.findOptimalWalkInSlot(
        sessionSlots,
        sessionAppointments,
        now,
        tokenDistribution,
        walkInSpacing,
        dto.isPriority
      );

      if (!targetSlot) {
        // If Force Booked by a nurse, assign to the very next empty slot beyond the session
        if (dto.isForceBooked) {
          console.warn('[WalkIn] Force-book: all buffer slots full. Appending beyond session end.');
          const occupiedIndices = new Set(
            sessionAppointments
              .filter(a => typeof a.slotIndex === 'number')
              .map(a => a.slotIndex!)
          );
          const fallback = sessionSlots.find(s => !occupiedIndices.has(s.index));
          if (!fallback) throw new Error('No walk-in slots available even with force-book.');
          // Reuse fallback as targetSlot by re-assigning (TypeScript scoping)
          return this._bookSlot(fallback, sessionSlots.length, txn, dto, doctor, clinic, patientId, activeSessionIndex, firestoreDateStr, now, tokenDistribution);
        }
        throw new Error('No walk-in slots available. All buffer slots for this session are occupied.');
      }

      return this._bookSlot(targetSlot, sessionSlots.length, txn, dto, doctor, clinic, patientId, activeSessionIndex, firestoreDateStr, now, tokenDistribution);
    });

    // ── SSE: Push real-time update to nurse dashboard ─────────────────────────
    sseService.emit('walk_in_created', dto.clinicId, {
      appointmentId: result.id,
      patientName: result.patientName,
      doctorId: result.doctorId,
      doctorName: result.doctorName,
      tokenNumber: result.tokenNumber,
      classicTokenNumber: result.classicTokenNumber,
      sessionIndex: result.sessionIndex,
      slotIndex: result.slotIndex,
    });

    return result;
  }

  /**
   * Locks the slot and saves the new W-Token appointment.
   * Extracted to avoid code duplication between normal and force-booked paths.
   */
  private async _bookSlot(
    targetSlot: import('../domain/services/SlotCalculator').DailySlot,
    totalSessionSlots: number,
    txn: admin.firestore.Transaction,
    dto: CreateWalkInAppointmentDTO,
    doctor: any,
    clinic: any,
    patientId: string,
    activeSessionIndex: number,
    firestoreDateStr: string,
    now: Date,
    tokenDistribution: 'classic' | 'advanced'
  ): Promise<Appointment> {
    const { tokenNumber, numericToken } = await this.tokenGenerator.generateToken(
      dto.clinicId,
      dto.doctorId,
      doctor.name,
      firestoreDateStr,
      'W',
      activeSessionIndex,
      tokenDistribution,
      txn as unknown as ITransaction,
      totalSessionSlots // ← Dynamic Base-100 offset
    );

    // Create the slot lock to prevent concurrent double-booking
    const lockId = `${dto.doctorId}_${firestoreDateStr}_s${activeSessionIndex}_slot${targetSlot.index}`;
    await this.appointmentRepo.createSlotLock(lockId, {
      appointmentId: `apt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      doctorId: dto.doctorId,
      date: firestoreDateStr,
      sessionIndex: activeSessionIndex,
      slotIndex: targetSlot.index
    }, txn as unknown as ITransaction);

    const isClassic = tokenDistribution === 'classic';
    const appointmentId = `apt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const appointment: Appointment = {
      id: appointmentId,
      patientId,
      patientName: dto.patientName,
      doctorId: dto.doctorId,
      doctorName: doctor.name,
      clinicId: dto.clinicId,
      date: firestoreDateStr,
      time: format(targetSlot.time, 'HH:mm'),
      status: 'Confirmed',
      tokenNumber,
      classicTokenNumber: isClassic ? tokenNumber : undefined,
      numericToken,
      bookedVia: 'Walk-in',
      slotIndex: targetSlot.index,
      sessionIndex: activeSessionIndex,
      arriveByTime: format(targetSlot.time, 'HH:mm'),
      isPriority: dto.isPriority,
      createdAt: now,
      updatedAt: now
    };

    await this.appointmentRepo.save(appointment, txn as unknown as ITransaction);

    // ── Atomically increment the session booked-count counter ──────────────
    // This runs inside the same txn as the appointment write.
    // Always increments — even for Force Bookings (allowing >100% load to be visible in the UI).
    await this.appointmentRepo.updateBookedCount(
      dto.clinicId,
      dto.doctorId,
      firestoreDateStr,
      activeSessionIndex,
      1,
      txn as unknown as ITransaction
    );

    return appointment;
  }
}
