import { Appointment } from '../../../packages/shared/src/index';
import {
  IAppointmentRepository,
  IDoctorRepository,
  IClinicRepository,
  ITransaction
} from '../domain/repositories';
import { ManagePatientUseCase } from './ManagePatientUseCase';
import { format, addMinutes } from 'date-fns';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { BookingSessionEngine } from '../domain/services/BookingSessionEngine';
import { WalkInPlacementService } from '../domain/services/WalkInPlacementService';
import { TokenGeneratorService } from '../domain/services/token/TokenGeneratorService';
import { sseService } from '../domain/services/SSEService';
import { getClinicNow, getClinicDateString, getClinicISODateString, parseClinicDate, getClinicTimeString } from '../domain/services/DateUtils';
import { DuplicateBookingError } from '../domain/errors';

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
  userLat?: number;
  userLon?: number;
  rescheduleFromId?: string;
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

    const tokenDistribution = (doctor.tokenDistribution || clinic.tokenDistribution || 'advanced') as 'classic' | 'advanced';
    const requestedDate = parseClinicDate(dto.date);
    const firestoreDateStr = getClinicISODateString(requestedDate);
    const allSlots = SlotCalculator.generateSlots(doctor, requestedDate);

    // ── PATIENT MANAGEMENT ────────────────────────────────────────────────────
    const normalizedPhone = dto.phone ? dto.phone.replace(/\D/g, '').slice(-10) : '';
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

    // ── PROXIMITY CHECK ───────────────────────────────────────────────────────
    if (!dto.isForceBooked && typeof dto.userLat === 'number' && typeof dto.userLon === 'number') {
      if (doctor.latitude && doctor.longitude) {
        const { calculateDistance } = await import('@kloqo/shared-core/src/utils/location-utils');
        const distance = calculateDistance(dto.userLat, dto.userLon, doctor.latitude, doctor.longitude);
        if (distance > 150) {
          throw new Error(`Location verification failed. Distance: ${Math.round(distance)}m`);
        }
      }
    }

    const now = getClinicNow();
    
    // 0. Load old appointment if rescheduling
    let oldAppt: Appointment | null = null;
    if (dto.rescheduleFromId) {
      oldAppt = await this.appointmentRepo.findById(dto.rescheduleFromId);
      if (oldAppt && oldAppt.patientId !== patientId) {
        throw new Error('Unauthorized to reschedule this appointment');
      }
    }

    // 1. READ ALL CURRENT APPOINTMENTS (to find a gap)
    const allAppointments = await this.appointmentRepo.findByDoctorAndDate(dto.doctorId, firestoreDateStr);

    // 2. ACTIVE SESSION DISCOVERY
    const activeSessionIndex = BookingSessionEngine.findActiveSession(
      doctor,
      allSlots,
      allAppointments,
      now,
      tokenDistribution
    );

    if (activeSessionIndex === null) {
      console.warn(`[CreateWalkInAppointment] No active session for doctor ${dto.doctorId}`);
      throw new Error('No active session found for walk-in booking.');
    }

    const sessionSlots = allSlots.filter(s => s.sessionIndex === activeSessionIndex);
    const sessionAppointments = allAppointments.filter(a => a.sessionIndex === activeSessionIndex);

    // 2b. DUPLICATE CHECK
    const isDuplicate = sessionAppointments.some(a =>
      a.patientId === patientId &&
      a.status !== 'Cancelled' &&
      a.id !== dto.rescheduleFromId
    );

    if (isDuplicate) {
      console.warn(`[CreateWalkInAppointment] Duplicate blocked for patient ${patientId}`);
      throw new DuplicateBookingError();
    }

    // 3. TARGET SLOT SELECTION
    const walkInSpacing = (clinic as any).walkInSpacing || (doctor as any).walkInSpacing || 0;
    let targetSlot = WalkInPlacementService.findOptimalWalkInSlot(
      sessionSlots,
      sessionAppointments,
      now,
      tokenDistribution,
      walkInSpacing,
      dto.isPriority
    );

    // 🚑 OVERTIME FALLBACK
    if (!targetSlot) {
      if (dto.isForceBooked) {
        const maxOccupiedIndex = sessionAppointments.length > 0 
          ? Math.max(...sessionAppointments.filter(a => typeof a.slotIndex === 'number').map(a => a.slotIndex!))
          : -1;
        const lastSessionSlot = sessionSlots[sessionSlots.length - 1];
        const overtimeIndex = Math.max(lastSessionSlot.index, maxOccupiedIndex) + 1;
        const avgConsultTime = (doctor as any).averageConsultingTime || 15;

        // ✅ FIX: Base virtual time on `now`, NOT the historical last slot time.
        // The last slot may have been 9:30 AM; we are booking at 3 PM.
        // We add one consulting-time unit to now to place them after the current patient.
        const virtualTime = addMinutes(now, avgConsultTime);

        targetSlot = {
          index: overtimeIndex,
          time: virtualTime,
          sessionIndex: activeSessionIndex
        };
      } else {
        throw new Error('No walk-in slots available.');
      }
    }

    // 🔄 RETRY LOOP: Fresh transactions per slot hunt
    let currentTargetSlot = { ...targetSlot };
    let finalAppointment: Appointment | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    while (!finalAppointment && attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        finalAppointment = await this.appointmentRepo.runTransaction(async (txn) => {
          return await this._bookSlot(
            currentTargetSlot as any,
            sessionSlots.length,
            txn as unknown as ITransaction,
            dto, doctor, clinic, patientId,
            activeSessionIndex, firestoreDateStr, now,
            tokenDistribution, oldAppt
          );
        });
      } catch (error: any) {
        if (error.message?.includes('ALREADY_EXISTS') || error.code === 6) {
          console.warn(`[CreateWalkInAppointment] Slot ${currentTargetSlot.index} collision. Retrying...`);
          currentTargetSlot = {
            ...currentTargetSlot,
            index: currentTargetSlot.index + 1,
            time: addMinutes(currentTargetSlot.time, (doctor as any).averageConsultingTime || 15),
            sessionIndex: activeSessionIndex
          };
          continue;
        }
        throw error;
      }
    }

    if (!finalAppointment) throw new Error('Failed to find an available slot.');

    // ── SSE ──────────────────────────────────────────────────────────────────
    sseService.emit('walk_in_created', dto.clinicId, {
      appointmentId: finalAppointment.id,
      patientName: finalAppointment.patientName,
      doctorId: finalAppointment.doctorId,
      doctorName: finalAppointment.doctorName,
      tokenNumber: finalAppointment.tokenNumber,
      classicTokenNumber: finalAppointment.classicTokenNumber,
      sessionIndex: finalAppointment.sessionIndex,
      slotIndex: finalAppointment.slotIndex,
    });

    return finalAppointment;
  }

  private async _bookSlot(
    targetSlot: any,
    totalSessionSlots: number,
    txn: ITransaction,
    dto: CreateWalkInAppointmentDTO,
    doctor: any,
    clinic: any,
    patientId: string,
    activeSessionIndex: number,
    firestoreDateStr: string,
    now: Date,
    tokenDistribution: 'classic' | 'advanced',
    oldAppt: Appointment | null
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
      totalSessionSlots,
      dto.isPriority,
      targetSlot.index
    );

    // ✅ Build the real appointment ID first so the lock references it correctly
    const appointmentId = `apt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const lockId = `${dto.doctorId}_${firestoreDateStr}_s${activeSessionIndex}_slot${targetSlot.index}`;
    await this.appointmentRepo.createSlotLock(lockId, {
      appointmentId,
      doctorId: dto.doctorId,
      date: firestoreDateStr,
      sessionIndex: activeSessionIndex,
      slotIndex: targetSlot.index
    }, txn);

    if (oldAppt && oldAppt.status !== 'Cancelled') {
      await this.appointmentRepo.update(oldAppt.id, {
        status: 'Cancelled',
        isRescheduled: true,
        updatedAt: now
      }, txn);
      const oldLockId = `${oldAppt.doctorId}_${oldAppt.date}_s${oldAppt.sessionIndex}_slot${oldAppt.slotIndex}`;
      await this.appointmentRepo.releaseSlotLock(oldLockId, txn).catch(() => {});
    }

    const displayTime = getClinicTimeString(targetSlot.time);
    console.log(`[CreateWalkInAppointment] Finalizing Appointment:`, {
      slotIndex: targetSlot.index,
      rawTime: targetSlot.time.toISOString(),
      displayTime
    });

    const appointment: Appointment = {
      id: appointmentId, // ✅ Use the pre-built ID (consistent with the lock)
      patientId,
      patientName: dto.patientName,
      doctorId: dto.doctorId,
      doctorName: doctor.name,
      clinicId: dto.clinicId,
      date: firestoreDateStr,
      time: displayTime,
      status: 'Confirmed',
      tokenNumber,
      classicTokenNumber: tokenDistribution === 'classic' ? tokenNumber : undefined,
      numericToken,
      bookedVia: 'Walk-in',
      slotIndex: targetSlot.index,
      sessionIndex: activeSessionIndex,
      arriveByTime: displayTime,
      isPriority: dto.isPriority,
      createdAt: now,
      updatedAt: now
    };

    await this.appointmentRepo.save(appointment, txn);
    await this.appointmentRepo.updateBookedCount(dto.clinicId, dto.doctorId, firestoreDateStr, activeSessionIndex, 1, txn);

    return appointment;
  }
}
