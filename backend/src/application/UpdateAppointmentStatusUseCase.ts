import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IConsultationCounterRepository } from '../domain/repositories';
import { TokenStrategyFactory } from '../domain/services/token/TokenStrategyFactory';
import { Appointment, compareAppointments, compareAppointmentsClassic } from '../../../packages/shared/src/index';
import { format } from 'date-fns';
import { NotificationService } from '../domain/services/NotificationService';
import { sseService } from '../domain/services/SSEService';
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
    const appointment = await this.appointmentRepo.findById(appointmentId);
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

    if (status === 'Completed') {
      appointment.completedAt = new Date();
      
      // Increment consultation counter
      if (appointment.sessionIndex !== undefined) {
        await this.counterRepo.increment(
          appointment.clinicId,
          appointment.doctorId,
          appointment.date,
          appointment.sessionIndex
        );
      }

      // Notify next patients
      await this.notificationService.notifyNextPatientsWhenCompleted({
        clinicId: appointment.clinicId,
        completedAppointmentId: appointmentId,
        completedAppointment: appointment,
        clinicName
      });

    } else if (status === 'Confirmed') {
      appointment.confirmedAt = new Date();


      // ── PER-DOCTOR DISTRIBUTION LOGIC ───────────────────────────────────────
      const doctor = await this.doctorRepo.findById(appointment.doctorId);
      const effectiveDistribution = doctor?.tokenDistribution || clinic?.tokenDistribution || 'advanced';

      // --- STRATEGY PATTERN: Assign arrival token (classic only) ---
      const tokenStrategy = TokenStrategyFactory.create(effectiveDistribution, this.tokenGenerator);
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
      // ── Decrement booked count (inside transaction below) ──
    } else if (status === 'No-show') {
      appointment.noShowAt = new Date();
      // ── Decrement booked count (inside transaction below) ──
    } else if (status === 'Cancelled') {
      if (appointment.patientId) {
        await this.notificationService.sendAppointmentCancelledNotification({
          patientId: appointment.patientId,
          appointmentId,
          doctorName: appointment.doctorName,
          clinicName,
          date: appointment.date,
          time: appointment.time,
          communicationPhone: appointment.communicationPhone,
          patientName: appointment.patientName,
          reason: 'clinic adjustment'
        });
      }

      // ── Release the Atomic Lock ─────────────────────────────────────────────
      if (appointment.slotIndex !== undefined && appointment.sessionIndex !== undefined) {
        const lockId = `${appointment.doctorId}_${appointment.date}_s${appointment.sessionIndex}_slot${appointment.slotIndex}`;
        await this.appointmentRepo.releaseSlotLock(lockId).catch(err => {
          console.warn(`[UpdateStatus] Failed to release lock ${lockId} for ${appointmentId}:`, err.message);
        });
      }
    }

    // ── ATOMIC WRITE: Appointment update + counter maintenance ─────────────
    // Both operations must succeed together to prevent counter drift.
    const isTerminalStatus = status === 'Skipped' || status === 'No-show' || status === 'Cancelled';
    const hasSesssionInfo = appointment.sessionIndex !== undefined && appointment.slotIndex !== undefined;

    await this.appointmentRepo.runTransaction(async (txn) => {
      // 🧼 WALK-IN DOWNGRADE PROTOCOL (Scenario A: Rahul's Late Arrival)
      // If a patient was Skipped and tries to re-confirm, we must verify if their slot was bubbled.
      if (oldStatus === 'Skipped' && status === 'Confirmed' && appointment.slotIndex !== undefined) {
        const allAppointments = await this.appointmentRepo.findByDoctorAndDate(
          appointment.doctorId,
          appointment.date
        );
        
        const isSlotAvailable = !allAppointments.some(a => 
          a.id !== appointment.id && 
          a.slotIndex === appointment.slotIndex && 
          a.sessionIndex === appointment.sessionIndex &&
          (a.status === 'Confirmed' || a.status === 'InConsultation' || a.status === 'Completed')
        );

        if (!isSlotAvailable) {
          console.warn(`[Downgrade] Slot ${appointment.slotIndex} was bubbled. Moving to next gap.`);
          
          appointment.bookedVia = 'Walk-in';
          const doctor = await this.doctorRepo.findById(appointment.doctorId);
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
            } else {
              // Forced overflow logic if session is 100% full
              const maxSlotInSession = sessionSlots.length > 0 ? Math.max(...sessionSlots.map((s: any) => s.index)) : 0;
              const maxOccupied = sessionAppts.length > 0 ? Math.max(...sessionAppts.map(a => a.slotIndex || 0)) : 0;
              appointment.slotIndex = Math.max(maxSlotInSession, maxOccupied) + 1;
            }

            // Issue new W-Token
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

      await this.appointmentRepo.update(appointmentId, appointment, txn);

      // Decrement bookedCount for every terminal status transition.
      // We do it here (not above) so it's always inside the same atomic block.
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

    // ── SSE: Broadcast real-time event to all connected clinic clients ──────
    sseService.emit('appointment_status_changed', appointment.clinicId, {
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

    // Buffer refill after terminal state transitions
    if (status === 'Completed' || status === 'Cancelled' || status === 'Skipped' || status === 'No-show') {
      await this.triggerBufferRefill(appointment.clinicId, appointment.doctorName);
    }

    // ── W-TOKEN BUBBLING: Move next W-Token into the vacated slot ──────────────
    // Only trigger for statuses where a slot becomes genuinely vacant.
    const shouldBubble = isTerminalStatus && hasSesssionInfo;
    if (shouldBubble && this.bubblingService) {
      this.bubblingService.reoptimize({
        vacatedSlotIndex: appointment.slotIndex!,
        sessionIndex: appointment.sessionIndex!,
        doctorId: appointment.doctorId,
        clinicId: appointment.clinicId,
        date: appointment.date,
      }).catch(err =>
        console.warn('[UpdateStatus] QueueBubbling failed (non-fatal):', err.message)
      );
    }

    return appointment;
  }

  private async triggerBufferRefill(clinicId: string, doctorName: string) {
    // Uses the ISO standard for today's query.
    // The repository's dual-format bridge will automatically check for both 'YYYY-MM-DD' and 'd MMMM yyyy'.
    const today = getClinicISODateString(new Date());
    const appointments = await this.appointmentRepo.findByClinicAndDate(clinicId, today);
    const doctorAppointments = appointments.filter(
      apt => apt.doctorName === doctorName && apt.status === 'Confirmed'
    );

    if (doctorAppointments.length === 0) return;

    const firstAppt = doctorAppointments[0];
    const doctor = await this.doctorRepo.findById(firstAppt.doctorId);
    const clinic = await this.clinicRepo.findById(clinicId);
    
    // Per-doctor distribution takes precedence
    const tokenDistribution = doctor?.tokenDistribution || clinic?.tokenDistribution || 'advanced';

    const currentBuffered = doctorAppointments.filter(a => a.isInBuffer);
    if (currentBuffered.length < 2) {
      const sorted = doctorAppointments.sort(
        tokenDistribution === 'advanced' ? compareAppointments : compareAppointmentsClassic
      );
      const nextCandidate = sorted.find(a => !a.isInBuffer);
      if (nextCandidate) {
        await this.appointmentRepo.update(nextCandidate.id, {
          isInBuffer: true,
          bufferedAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`Buffer Refill: Promoted patient ${nextCandidate.id} to buffer for Doctor ${doctorName}`);
      }
    }
  }
}
