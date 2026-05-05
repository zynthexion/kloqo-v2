// ╔══════════════════════════════════════════════════════════════════════════╗
// ║                    ⚠️  AI GUARD — DO NOT EDIT                           ║
// ║                                                                          ║
// ║  This file contains the Update Appointment Status Use Case.              ║
// ║  It triggers critical queue bubbling on skip/cancel events.               ║
// ║                                                                          ║
// ║  🚫 AI models MUST NOT modify this file without explicit written         ║
// ║     permission from the project owner (Jino Devasia).                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IConsultationCounterRepository } from '../domain/repositories';
import { TokenStrategyFactory } from '../domain/services/token/TokenStrategyFactory';
import { Appointment, compareAppointments, compareAppointmentsClassic } from '../../../packages/shared/src/index';
import { format } from 'date-fns';
import { NotificationService } from '../domain/services/NotificationService';
import { SSEService } from '../domain/services/SSEService';
import { QueueBubblingService } from '../domain/services/QueueBubblingService';
import { TokenGeneratorService } from '../domain/services/token/TokenGeneratorService';
import { SlotsFullError } from '../domain/errors';
import { getClinicISODateString, parseClinicDate, getClinicNow } from '../domain/services/DateUtils';

export class UpdateAppointmentStatusUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository,
    private notificationService: NotificationService,
    private counterRepo: IConsultationCounterRepository,
    private tokenGenerator: TokenGeneratorService,
    private tokenStrategyFactory: TokenStrategyFactory,
    private sseService: SSEService,
    private bubblingService?: QueueBubblingService
  ) { }
  async execute(params: {
    appointmentId: string;
    status: Appointment['status'];
    clinicId: string;
    nurseId?: string;
    time?: string;
    isPriority?: boolean;
  }): Promise<Appointment> {
    const { appointmentId, status, time, isPriority } = params;

    // --- FAIL FAST: Validate before any processing ---
    const appointment = await this.appointmentRepo.findById(appointmentId, params.clinicId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.clinicId !== params.clinicId) {
      throw new Error('Unauthorized: Appointment does not belong to this clinic');
    }

    const clinic = await this.clinicRepo.findById(appointment.clinicId);
    const clinicName = clinic?.name || 'the clinic';
    const oldStatus = appointment.status;
    appointment.status = status;

    if (time) {
      appointment.time = time;
    }

    if (isPriority !== undefined) {
      appointment.isPriority = isPriority;
      appointment.priorityAt = isPriority ? new Date() : null;
    }

    // Always clear buffer when moving out of active state
    appointment.isInBuffer = false;
    appointment.bufferedAt = null;

    // ── Release the Atomic Lock for all terminal statuses ──────────────────────────
    const isTerminalStatus = status === 'Skipped' || status === 'No-show' || status === 'Cancelled';
    const hasSesssionInfo = appointment.sessionIndex !== undefined && appointment.slotIndex !== undefined;

    if (isTerminalStatus && hasSesssionInfo) {
      const lockId = `${appointment.doctorId}_${appointment.date}_s${appointment.sessionIndex}_slot${appointment.slotIndex}`;
      await this.appointmentRepo.releaseSlotLock(lockId).catch(err => {
        console.warn(`[UpdateStatus] Failed to release lock ${lockId} for ${appointmentId}:`, err.message);
      });
    }

    if (status === 'Completed') {
      appointment.completedAt = new Date();
    } else if (status === 'Confirmed') {
      appointment.confirmedAt = new Date();

      // ── PER-DOCTOR DISTRIBUTION LOGIC ───────────────────────────────────────
      const doctor = await this.doctorRepo.findById(appointment.doctorId, appointment.clinicId);
      const effectiveDistribution = doctor?.tokenDistribution || clinic?.tokenDistribution || 'advanced';

      // --- STRATEGY PATTERN: Assign arrival token (classic only) ---
      const tokenStrategy = this.tokenStrategyFactory.create(effectiveDistribution);
      const classicTokenNumber = await tokenStrategy.generateArrivalToken({
        clinicId: appointment.clinicId,
        doctorId: appointment.doctorId,
        doctorName: appointment.doctorName,
        date: appointment.date,
        sessionIndex: appointment.sessionIndex || 0,
        appointmentId,
        existingClassicTokenNumber: appointment.classicTokenNumber as any,
      });

      if (classicTokenNumber) {
        appointment.classicTokenNumber = classicTokenNumber;
      }

    } else if (status === 'Skipped') {
      appointment.skippedAt = new Date();
    } else if (status === 'No-show') {
      appointment.noShowAt = new Date();
    } else if (status === 'Cancelled') {
      (appointment as any).cancelledAt = new Date();
    }

    // Clear buffer and lock flags if moving out of active states
    if (['Skipped', 'No-show', 'Cancelled', 'Pending', 'InConsultation'].includes(status)) {
      appointment.isInBuffer = false;
      appointment.bufferedAt = null;
      appointment.isNextLocked = false;
      appointment.lockedAt = null;
    }

    // ── ATOMIC WRITE: Appointment update + counter maintenance ─────────────
    // Both operations must succeed together to prevent counter drift.

    await this.appointmentRepo.runTransaction(async (txn) => {
      // 🧼 WALK-IN DOWNGRADE PROTOCOL
      const isLateRejoin = (oldStatus === 'Skipped' || oldStatus === 'No-show') && status === 'Confirmed';
      if (isLateRejoin && appointment.slotIndex !== undefined) {
        const allAppointments = await this.appointmentRepo.findByDoctorAndDate(
          appointment.doctorId,
          appointment.clinicId,
          appointment.date,
          txn
        );

        // 🧼 MANDATORY DOWNGRADE FOR LATE REJOIN
        // Any patient rejoining from Skipped/No-show loses their original slot 
        // and is treated as a Walk-in at the end of the queue.
        appointment.bookedVia = 'Walk-in';
        const doctor = await this.doctorRepo.findById(appointment.doctorId, appointment.clinicId, txn);
        const effectiveDistribution = doctor?.tokenDistribution || clinic?.tokenDistribution || 'advanced';

        if (doctor) {
          const allSlots = require('../domain/services/SlotCalculator').SlotCalculator.generateSlots(doctor, parseClinicDate(appointment.date));
          const sessionSlots = allSlots.filter((s: any) => s.sessionIndex === appointment.sessionIndex);
          const sessionAppts = allAppointments.filter(a => a.sessionIndex === appointment.sessionIndex);

          const newSlot = require('../domain/services/WalkInPlacementService').WalkInPlacementService.findOptimalWalkInSlot(
            sessionSlots,
            sessionAppts,
            getClinicNow(),
            effectiveDistribution as any,
            doctor.walkInTokenAllotment || clinic?.walkInTokenAllotment || 0,
            appointment.isPriority,
            doctor.averageConsultingTime,
            true // allowOverflow: Always allow rejoining patients to find a spot
          );

          if (newSlot) {
            const lastDefinedSlot = sessionSlots[sessionSlots.length - 1];
            if (newSlot.index > (lastDefinedSlot?.index || 0)) {
              appointment.isForceBooked = true;
              console.log(`[UpdateStatus] 🚨 Overflow detected for ${appointment.tokenNumber}. Flagging as isForceBooked.`);
            }
            appointment.slotIndex = newSlot.index;
            appointment.time = format(newSlot.time, 'HH:mm');
          }

          const totalSlots = (appointment as any).totalSlots || Math.max(100, sessionSlots.length);
          const { tokenNumber, numericToken } = await this.tokenGenerator.generateToken(
            appointment.clinicId,
            appointment.doctorId,
            appointment.doctorName,
            appointment.date,
            'W',
            appointment.sessionIndex || 0,
            effectiveDistribution as any,
            txn,
            totalSlots,
            appointment.isPriority,
            appointment.slotIndex
          );
          appointment.tokenNumber = tokenNumber;
          appointment.numericToken = numericToken;

          // Ensure classic token is also updated if in classic mode
          if (effectiveDistribution === 'classic') {
            appointment.classicTokenNumber = tokenNumber;
          }
        }
      }

      // 🔒 NEXT-PATIENT LOCK (The "Door Lock")
      // When a doctor starts a consultation, we scan the remaining queue, 
      // find the highest-priority Confirmed patient, and flag them as isNextLocked.
      if (status === 'InConsultation') {
        const allAppointments = await this.appointmentRepo.findByDoctorAndDate(
          appointment.doctorId,
          appointment.clinicId,
          appointment.date,
          txn
        );

        // 1. Clear any existing locks for this session to prevent multiple locks
        const lockedAppts = allAppointments.filter(a => a.isNextLocked && a.sessionIndex === appointment.sessionIndex);
        for (const locked of lockedAppts) {
          if (locked.id !== appointment.id) {
            await this.appointmentRepo.update(locked.id, appointment.clinicId, { isNextLocked: false, lockedAt: null }, txn);
          }
        }

        // 2. Identify the new "Next" person from the arrived pool
        const doctor = await this.doctorRepo.findById(appointment.doctorId, appointment.clinicId, txn);
        const distribution = doctor?.tokenDistribution || clinic?.tokenDistribution || 'advanced';

        const confirmedAppts = allAppointments
          .filter(a =>
            a.id !== appointment.id &&
            a.status === 'Confirmed' &&
            a.sessionIndex === appointment.sessionIndex
          )
          .sort(distribution === 'advanced' ? compareAppointments : compareAppointmentsClassic);

        console.log(`[NextLock] Mode: ${distribution}. Next: ${confirmedAppts[0]?.tokenNumber}(Slot:${confirmedAppts[0]?.slotIndex})`);

        if (confirmedAppts.length > 0) {
          const nextPatient = confirmedAppts[0];
          await this.appointmentRepo.update(nextPatient.id, appointment.clinicId, {
            isNextLocked: true,
            lockedAt: new Date()
          }, txn);

          // 📢 Emit SSE for the newly locked patient so the UI updates immediately
          this.sseService.emit('appointment_status_changed', appointment.clinicId, {
            appointmentId: nextPatient.id,
            newStatus: nextPatient.status,
            isNextLocked: true
          });

          console.log(`[QueueLock] 🔒 Locked ${nextPatient.tokenNumber} as NEXT patient.`);
        }
      }

      await this.appointmentRepo.update(appointmentId, appointment.clinicId, appointment, txn);

      // 📢 REAL-TIME UI SYNC: Notify Nurse/Doctor apps of the status change (e.g. InConsultation)
      this.sseService.emit('appointment_status_changed', appointment.clinicId, {
        appointmentId: appointmentId,
        newStatus: appointment.status,
        doctorStatus: 'IN' // Standardized state for active dashboard
      });

      if (status === 'Completed' && appointment.sessionIndex !== undefined) {
        await this.counterRepo.increment(
          appointment.clinicId,
          appointment.doctorId,
          appointment.date,
          appointment.sessionIndex
        );
      }

      if (isTerminalStatus && hasSesssionInfo) {
        await this.appointmentRepo.updateBookedCount(
          appointment.clinicId,
          appointment.doctorId,
          appointment.date,
          appointment.sessionIndex!,
          -1,
          txn
        );
      }
    });

    // ── POST-TRANSACTION SIDE EFFECTS ──

    this.sseService.emit('appointment_status_changed', appointment.clinicId, {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName,
      oldStatus,
      newStatus: status,
      tokenNumber: appointment.tokenNumber,
      classicTokenNumber: appointment.classicTokenNumber,
      sessionIndex: appointment.sessionIndex,
      slotIndex: appointment.slotIndex,
      isInBuffer: appointment.isInBuffer,
      isNextLocked: appointment.isNextLocked,
    });

    if (status === 'Completed') {
      this.notificationService.notifyNextPatientsWhenCompleted({
        clinicId: appointment.clinicId,
        completedAppointmentId: appointmentId,
        completedAppointment: appointment,
        clinicName
      }).catch(err => console.error('[UpdateStatus] Completed notification error:', err));
    } else if (status === 'Cancelled' && appointment.patientId) {
      this.notificationService.sendAppointmentCancelledNotification({
        patientId: appointment.patientId,
        appointmentId,
        doctorName: appointment.doctorName,
        clinicName,
        date: appointment.date,
        time: appointment.time,
        clinicId: appointment.clinicId,
        communicationPhone: appointment.communicationPhone,
        patientName: appointment.patientName,
        reason: 'clinic adjustment'
      }).catch(err => console.error('[UpdateStatus] Cancelled notification error:', err));
    } else if (time && appointment.patientId) {
      // 📢 Notify if time was manually changed (Manual Reschedule)
      this.notificationService.sendAppointmentRescheduledNotification({
        patientId: appointment.patientId,
        appointmentId,
        doctorName: appointment.doctorName,
        clinicName,
        oldDate: appointment.date,
        oldTime: '',
        newDate: appointment.date,
        newTime: appointment.time,
        clinicId: appointment.clinicId,
        communicationPhone: appointment.communicationPhone,
        patientName: appointment.patientName,
        arriveByTime: appointment.arriveByTime
      }).catch(err => console.error('[UpdateStatus] Rescheduled notification error:', err));
    }

    const shouldBubble = ['Cancelled', 'Skipped', 'No-show'].includes(status);

    if (['Completed', 'Cancelled', 'Skipped', 'No-show', 'Confirmed', 'InConsultation'].includes(status)) {
      await this.triggerBufferRefill(appointment.clinicId, appointment.doctorId, appointment.doctorName);
    }

    if (shouldBubble && this.bubblingService) {
      this.bubblingService.reoptimize({
        vacatedSlotIndex: appointment.slotIndex!,
        sessionIndex: appointment.sessionIndex!,
        doctorId: appointment.doctorId,
        clinicId: appointment.clinicId,
        date: appointment.date,
      }).catch(err => console.warn('[UpdateStatus] QueueBubbling failed:', err.message));
    }

    return appointment;
  }

  private async triggerBufferRefill(clinicId: string, doctorId: string, doctorName: string) {
    const now = getClinicNow();
    const today = getClinicISODateString(now);
    const appointments = await this.appointmentRepo.findByClinicAndDate(clinicId, today);

    const doctorAppointments = appointments.filter(
      apt => apt.doctorId === doctorId && apt.status === 'Confirmed'
    );

    const clinic = await this.clinicRepo.findById(clinicId);
    const doctor = await this.doctorRepo.findById(doctorId, clinicId);
    const distribution = doctor?.tokenDistribution || clinic?.tokenDistribution || 'advanced';

    const sorted = doctorAppointments.sort(
      distribution === 'advanced' ? compareAppointments : compareAppointmentsClassic
    );

    console.log(`[BufferSync] Mode: ${distribution}. Top 2 IDs:`, sorted.slice(0, 2).map(a => `${a.tokenNumber}(Slot:${a.slotIndex})`));

    const top2Ids = sorted.slice(0, 2).map(a => a.id);

    for (const appt of doctorAppointments) {
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
}
