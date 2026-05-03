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
  ) {}
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
    
    // Clear buffer flag if moving out of Confirmed
    if (['Skipped', 'No-show', 'Cancelled', 'Pending', 'InConsultation'].includes(status)) {
      appointment.isInBuffer = false;
      appointment.bufferedAt = null;
    }

    // ── ATOMIC WRITE: Appointment update + counter maintenance ─────────────
    // Both operations must succeed together to prevent counter drift.

    await this.appointmentRepo.runTransaction(async (txn) => {
      // 🧼 WALK-IN DOWNGRADE PROTOCOL
      if (oldStatus === 'Skipped' && status === 'Confirmed' && appointment.slotIndex !== undefined) {
        const allAppointments = await this.appointmentRepo.findByDoctorAndDate(
          appointment.doctorId,
          appointment.clinicId,
          appointment.date,
          txn
        );
        
        const isSlotAvailable = !allAppointments.some(a => 
          a.id !== appointment.id && 
          a.slotIndex === appointment.slotIndex && 
          a.sessionIndex === appointment.sessionIndex &&
          (a.status === 'Confirmed' || a.status === 'InConsultation' || a.status === 'Completed')
        );

        if (!isSlotAvailable) {
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
              appointment.isPriority
            );
            
            if (newSlot) {
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
          }
        }
      }

      await this.appointmentRepo.update(appointmentId, appointment.clinicId, appointment, txn);

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
    const today = getClinicISODateString(new Date());
    const appointments = await this.appointmentRepo.findByClinicAndDate(clinicId, today);
    const doctorAppointments = appointments.filter(
      apt => apt.doctorId === doctorId && apt.status === 'Confirmed'
    );

    if (doctorAppointments.length === 0) return;

    const doctor = await this.doctorRepo.findById(doctorId, clinicId);
    const clinic = await this.clinicRepo.findById(clinicId);
    
    const tokenDistribution = doctor?.tokenDistribution || clinic?.tokenDistribution || 'advanced';

    let currentBuffered = doctorAppointments.filter(a => a.isInBuffer);
    
    const sorted = doctorAppointments.sort((a, b) => {
      const sA = a.slotIndex ?? 999;
      const sB = b.slotIndex ?? 999;
      return sA - sB;
    });

    const correctBufferIds = sorted.slice(0, 2).map(a => a.id);

    for (const appt of doctorAppointments) {
      const shouldBeBuffered = correctBufferIds.includes(appt.id);
      
      if (shouldBeBuffered && !appt.isInBuffer) {
        await this.appointmentRepo.update(appt.id, clinicId, {
          isInBuffer: true,
          bufferedAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`Buffer Sync: ✅ Promoted ${appt.tokenNumber} to buffer`);
      } else if (!shouldBeBuffered && appt.isInBuffer) {
        await this.appointmentRepo.update(appt.id, clinicId, {
          isInBuffer: false,
          bufferedAt: null,
          updatedAt: new Date()
        });
        console.log(`Buffer Sync: ⚠️ Removed ${appt.tokenNumber} from buffer (out of rank)`);
      }
    }
  }
}
