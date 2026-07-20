// ╔══════════════════════════════════════════════════════════════════════════╗
// ║                    ⚠️  AI GUARD — DO NOT EDIT                           ║
// ║                                                                          ║
// ║  This file contains the Create Walk-In Appointment Use Case.              ║
// ║  It coordinates token generation and slot booking transactions.           ║
// ║                                                                          ║
// ║  🚫 AI models MUST NOT modify this file without explicit written         ║
// ║     permission from the project owner (Jino Devasia).                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { Appointment, compareAppointments, compareAppointmentsClassic } from '../../../packages/shared/src/index';
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
import { SSEService } from '../domain/services/SSEService';
import { getClinicNow, getClinicDateString, getClinicISODateString, parseClinicDate, getClinicTimeString } from '../domain/services/DateUtils';
import { DuplicateBookingError } from '../domain/errors';
import { NotificationService } from '../domain/services/NotificationService';

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
    private tokenGenerator: TokenGeneratorService,
    private sseService: SSEService,
    private notificationService?: NotificationService
  ) {}

  async execute(dto: CreateWalkInAppointmentDTO): Promise<Appointment> {
    // ── FAIL FAST: Validate domain objects before any operations ──────────────
    const doctor = await this.doctorRepo.findById(dto.doctorId, dto.clinicId);
    if (!doctor) throw new Error('Doctor not found');

    const clinic = await this.clinicRepo.findById(dto.clinicId);
    if (!clinic) throw new Error('Clinic not found');

    const tokenDistribution = (doctor.tokenDistribution || clinic.tokenDistribution || 'advanced') as 'classic' | 'advanced';
    const requestedDate = parseClinicDate(dto.date);
    const firestoreDateStr = getClinicISODateString(requestedDate);
    const allSlots = SlotCalculator.generateSlots(doctor, requestedDate);

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

    const now = new Date();
    
    // 1. READ ALL CURRENT APPOINTMENTS (to find a gap)
    const allAppointments = await this.appointmentRepo.findByDoctorAndDate(dto.doctorId, dto.clinicId, firestoreDateStr);

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

    // 3. TARGET SLOT SELECTION
    const walkInSpacing = (clinic as any).walkInSpacing || (doctor as any).walkInSpacing || 0;
    let targetSlot = WalkInPlacementService.findOptimalWalkInSlot(
      sessionSlots,
      sessionAppointments,
      now,
      tokenDistribution,
      walkInSpacing,
      dto.isPriority,
      doctor.averageConsultingTime,
      dto.isForceBooked
    );

    // 🚑 OVERFLOW FLAG (isForceBooked)
    if (targetSlot) {
      const lastDefinedSlot = sessionSlots[sessionSlots.length - 1];
      if (targetSlot.index > (lastDefinedSlot?.index || 0)) {
        dto.isForceBooked = true; // Mark as force-booked if placed in overflow
      }
    } else {
      throw new Error('No walk-in slots available.');
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
          // ── PATIENT MANAGEMENT (Now inside transaction) ──────────────
          const normalizedPhone = dto.phone ? dto.phone.replace(/\D/g, '').slice(-10) : '';
          const patientIdentification = await this.managePatientUseCase.identifyPatient({
            id: dto.patientId,
            name: dto.patientName,
            phone: normalizedPhone,
            communicationPhone: dto.communicationPhone,
            clinicId: dto.clinicId,
          }, txn as unknown as ITransaction);

          const patientId = patientIdentification.targetId;

          // ── RESCHEDULING & DUPLICATE CHECKS (Inside transaction for atomic patientId safety) ──
          let oldAppt: Appointment | null = null;
          if (dto.rescheduleFromId) {
            oldAppt = await this.appointmentRepo.findById(dto.rescheduleFromId, dto.clinicId);
            if (oldAppt && oldAppt.patientId !== patientId) {
              throw new Error('Unauthorized to reschedule this appointment');
            }
          }

          const isDuplicate = sessionAppointments.some(a =>
            a.patientId === patientId &&
            a.status !== 'Cancelled' &&
            a.id !== dto.rescheduleFromId
          );

          if (isDuplicate) {
            console.warn(`[CreateWalkInAppointment] Duplicate blocked for patient ${patientId}`);
            throw new DuplicateBookingError();
          }

          return await this._bookSlot(
            currentTargetSlot as any,
            sessionSlots.length,
            txn as unknown as ITransaction,
            dto, doctor, clinic, patientId, patientIdentification,
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

    // ── TRIGGER QUEUE SYNC ──────────────────────────────────────────────────
    await this.triggerBufferRefill(dto.clinicId, dto.doctorId);

    // ── SSE ──────────────────────────────────────────────────────────────────
    this.sseService.emit('walk_in_created', dto.clinicId, {
      appointment: finalAppointment
    });

    // ── Notifications ────────────────────────────────────────────────────────
    if (this.notificationService) {
      if (dto.rescheduleFromId) {
        this.notificationService.sendAppointmentRescheduledNotification({
          patientId: finalAppointment.patientId!,
          appointmentId: finalAppointment.id,
          doctorName: finalAppointment.doctorName,
          clinicName: clinic.name,
          oldDate: '',
          oldTime: '',
          newDate: finalAppointment.date,
          newTime: finalAppointment.time,
          clinicId: finalAppointment.clinicId,
          communicationPhone: dto.communicationPhone,
          patientName: finalAppointment.patientName,
          arriveByTime: finalAppointment.arriveByTime
        }).catch(err => console.error('[Notification] Reschedule notify failed:', err));
      } else {
        this.notificationService.sendAppointmentBookedNotification({
          patientId: finalAppointment.patientId!,
          appointmentId: finalAppointment.id,
          doctorName: finalAppointment.doctorName,
          clinicName: clinic.name,
          date: finalAppointment.date,
          time: finalAppointment.time,
          clinicId: finalAppointment.clinicId,
          tokenNumber: finalAppointment.tokenNumber,
          arriveByTime: finalAppointment.arriveByTime
        }).catch(err => console.error('[Notification] Booking notify failed:', err));
      }
    }

    return finalAppointment;
  }

  /**
   * Re-evaluates the top of the queue and updates buffer/lock tags.
   */
  private async triggerBufferRefill(clinicId: string, doctorId: string) {
    const now = new Date();
    const today = getClinicISODateString(now);
    const appointments = await this.appointmentRepo.findByClinicAndDate(clinicId, today);
    
    const clinic = await this.clinicRepo.findById(clinicId);
    const doctor = await this.doctorRepo.findById(doctorId, clinicId);
    const distribution = doctor?.tokenDistribution || clinic?.tokenDistribution || 'advanced';

    // Find all active confirmed patients for this doctor
    const confirmedAppts = appointments
      .filter(a => 
        a.doctorId === doctorId && 
        a.status === 'Confirmed'
      );

    const sorted = confirmedAppts.sort(
      distribution === 'advanced' ? compareAppointments : compareAppointmentsClassic
    );

    const top2Ids = sorted.slice(0, 2).map(a => a.id);
    
    for (const appt of confirmedAppts) {
      const shouldBeBuffered = top2Ids.includes(appt.id);
      const isFirst = sorted.length > 0 && sorted[0].id === appt.id;
      
      // Lock logic: Always lock the first confirmed person so they are "At Door"
      const shouldBeLocked = isFirst;

      const updates: any = {};
      let changed = false;

      if (shouldBeBuffered !== appt.isInBuffer) {
        updates.isInBuffer = shouldBeBuffered;
        updates.bufferedAt = shouldBeBuffered ? now : null;
        changed = true;
      }

      if (shouldBeLocked !== appt.isNextLocked) {
        updates.isNextLocked = shouldBeLocked;
        updates.lockedAt = shouldBeLocked ? now : null;
        changed = true;

        // 📢 NOTIFY: Locked at Door (Zomato-style "Your order is ready")
        if (shouldBeLocked && this.notificationService && appt.patientId) {
          this.notificationService.sendQueuePositionUpdateNotification({
            patientId: appt.patientId,
            appointmentId: appt.id,
            clinicName: clinic?.name || '',
            peopleAhead: 0,
            clinicId,
            communicationPhone: appt.communicationPhone,
            patientName: appt.patientName
          }).catch(err => console.error('[Notification] At Door notify failed:', err));
        }
      }

      if (changed) {
        await this.appointmentRepo.update(appt.id, clinicId, {
          ...updates,
          updatedAt: now
        });

        // 📢 REAL-TIME UI SYNC: Notify all apps of buffer/lock changes
        this.sseService.emit('appointment_status_changed', clinicId, {
          appointmentId: appt.id,
          newStatus: appt.status,
          isInBuffer: updates.isInBuffer ?? appt.isInBuffer,
          isNextLocked: updates.isNextLocked ?? appt.isNextLocked,
          doctorStatus: 'IN'
        });

        console.log(`[QueueSync] Updated ${appt.tokenNumber}: Buffer=${shouldBeBuffered}, Locked=${shouldBeLocked}`);
      }
    }
  }

  private async _bookSlot(
    targetSlot: any,
    totalSessionSlots: number,
    txn: ITransaction,
    dto: CreateWalkInAppointmentDTO,
    doctor: any,
    clinic: any,
    patientId: string,
    patientIdentification: any,
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

    // ── PATIENT PERSISTENCE (WRITE PHASE) ──
    const normalizedPhone = dto.phone ? dto.phone.replace(/\D/g, '').slice(-10) : '';
    await this.managePatientUseCase.persistPatient({
      id: dto.patientId,
      name: dto.patientName,
      phone: normalizedPhone,
      communicationPhone: dto.communicationPhone,
      age: dto.age,
      sex: dto.sex,
      place: dto.place,
      clinicId: dto.clinicId,
    }, patientIdentification, dto.clinicId, txn as unknown as ITransaction);

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
      await this.appointmentRepo.update(oldAppt.id, oldAppt.clinicId, {
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
      originalTime: displayTime,
      originalArriveByTime: displayTime,
      isPriority: dto.isPriority,
      createdAt: now,
      updatedAt: now
    };

    await this.appointmentRepo.save(appointment, dto.clinicId, txn);
    await this.appointmentRepo.updateBookedCount(dto.clinicId, dto.doctorId, firestoreDateStr, activeSessionIndex, 1, txn);

    return appointment;
  }
}
