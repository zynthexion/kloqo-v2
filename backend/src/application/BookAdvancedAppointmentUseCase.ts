import { 
  IAppointmentRepository, 
  IDoctorRepository, 
  IPatientRepository, 
  IClinicRepository 
} from '../domain/repositories';
import { ManagePatientUseCase } from './ManagePatientUseCase';
import { ITokenStrategy } from '../domain/services/token/ITokenStrategy';
import { TokenStrategyFactory } from '../domain/services/token/TokenStrategyFactory';
import { Appointment, Patient, User } from '../../../packages/shared/src/index';
import { format, subMinutes, parse } from 'date-fns';
import { parseClinicTime, parseClinicDate, getClinicISODateString, getClinicTimeString, getClinicNow } from '../domain/services/DateUtils';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { BookingSessionEngine } from '../domain/services/BookingSessionEngine';
import { SlotAlreadyBookedError, DuplicateBookingError } from '../domain/errors';
import { SSEService } from '../domain/services/SSEService';

export interface BookAdvancedAppointmentRequest {
  clinicId: string;
  doctorId: string;
  patientId?: string;
  patientName?: string;
  phone?: string;
  age?: number;
  sex?: 'Male' | 'Female' | 'Other' | '';
  place?: string;
  communicationPhone?: string;
  date: string; // "d MMMM yyyy"
  slotIndex: number;
  sessionIndex: number;
  slotTime: string; // "HH:mm"
  source?: string;
  rescheduleFromId?: string;
}

import { TokenGeneratorService } from '../domain/services/token/TokenGeneratorService';

export class BookAdvancedAppointmentUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private patientRepo: IPatientRepository,
    private clinicRepo: IClinicRepository,
    private managePatientUseCase: ManagePatientUseCase,
    private tokenGenerator: TokenGeneratorService,
    private tokenStrategyFactory: TokenStrategyFactory,
    private sseService: SSEService
  ) {}

  async execute(request: BookAdvancedAppointmentRequest): Promise<Appointment> {
    const { clinicId, doctorId, slotIndex, sessionIndex, source } = request;
    const patientId = request.patientId || undefined; // Prevents documentPath "" error
    const slotTime = request.slotTime || (request as any).time;

    console.log('[BookAdvancedAppointmentUseCase] START', { clinicId, doctorId, patientId, slotTime, slotIndex, sessionIndex });

    // Normalize Date to new ISO standard "YYYY-MM-DD"
    const incomingDate = request.date;
    const date = parseClinicDate(incomingDate);
    
    const firestoreDateStr = getClinicISODateString(date);

    // --- FAIL FAST: Validate all inputs ---
    const doctor = await this.doctorRepo.findById(doctorId, clinicId);
    if (!doctor) throw new Error('Doctor not found');

    if (!clinicId) {
        console.error('[BookAdvancedAppointmentUseCase] Error: clinicId is empty');
        throw new Error('Clinic ID is required');
    }
    const clinic = await this.clinicRepo.findById(clinicId);
    if (!clinic) throw new Error('Clinic not found');

    const patientName = ''; // Will be populated inside transaction

    // --- STRATEGY PATTERN: Factory picks the correct token strategy ---
    const tokenDistribution = (doctor.tokenDistribution || clinic.tokenDistribution || 'advanced') as 'classic' | 'advanced';
    const tokenStrategy = this.tokenStrategyFactory.create(tokenDistribution);

    // Calculate Arrive By Time (15 mins before)
    const appointmentTime = parseClinicTime(slotTime, date);
    const arriveByTime = subMinutes(appointmentTime, 15);
    
    // Create new deterministic Object ID
    const appointmentId = `apt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Generate Lock ID
    const lockId = `${doctorId}_${firestoreDateStr}_s${sessionIndex}_slot${slotIndex}`;

    try {
      const appointment = await this.appointmentRepo.runTransaction(async (transaction) => {
        // --- STEP 1: READ PHASE ---
        const patientIdentification = await this.managePatientUseCase.identifyPatient({
          id: patientId,
          name: request.patientName || '',
          phone: request.phone || '',
          communicationPhone: request.communicationPhone,
          clinicId: clinicId
        }, transaction);

        const finalPatientId = patientIdentification.targetId;

        // 0. Duplicate Check
        const existingAppts = await this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, firestoreDateStr, transaction);
        const isDuplicate = existingAppts.some(a =>
          a.patientId === finalPatientId &&
          a.sessionIndex === sessionIndex &&
          a.status !== 'Cancelled' &&
          a.id !== request.rescheduleFromId
        );

        // 0a. Load old appointment if rescheduling
        let oldAppt: Appointment | null = null;
        if (request.rescheduleFromId) {
          oldAppt = await this.appointmentRepo.findById(request.rescheduleFromId, clinicId, transaction);
          if (oldAppt && oldAppt.patientId !== finalPatientId) {
            throw new Error('Unauthorized to reschedule this appointment');
          }
        }

        if (isDuplicate) {
          throw new DuplicateBookingError();
        }

        // 0b. Buffer Slot Guard
        if (tokenDistribution === 'advanced') {
          const allSlots = SlotCalculator.generateSlots(doctor, date);
          const reservedSlotIndices = BookingSessionEngine.calculateReservedSlots(allSlots, parseClinicTime('00:00', date));
          if (reservedSlotIndices.has(slotIndex)) {
            throw new SlotAlreadyBookedError();
          }
        }

        const tokenResult = await tokenStrategy.generateBookingToken({
          clinicId,
          doctorId,
          doctorName: doctor.name,
          date: firestoreDateStr,
          sessionIndex,
          slotIndex
        }, transaction);

        // --- STEP 2: WRITE PHASE ---
        await this.managePatientUseCase.persistPatient({
          id: patientId,
          name: request.patientName || '',
          phone: request.phone || '',
          age: request.age,
          sex: request.sex,
          place: request.place,
          communicationPhone: request.communicationPhone,
          clinicId: clinicId
        }, patientIdentification, clinicId, transaction);

        await this.appointmentRepo.createSlotLock(lockId, {
          appointmentId,
          doctorId,
          date: firestoreDateStr,
          sessionIndex,
          slotIndex
        }, transaction);

        if (oldAppt && oldAppt.status !== 'Cancelled') {
          const oldLockId = `${oldAppt.doctorId}_${oldAppt.date}_s${oldAppt.sessionIndex}_slot${oldAppt.slotIndex}`;
          await this.appointmentRepo.update(oldAppt.id, oldAppt.clinicId, {
            status: 'Cancelled',
            isRescheduled: true,
            cancellationReason: 'Rescheduled by patient',
            updatedAt: getClinicNow()
          }, transaction);
          await this.appointmentRepo.releaseSlotLock(oldLockId, transaction).catch(() => {});
        }

        const appt: Appointment = {
          id: appointmentId,
          patientId: finalPatientId,
          patientName: patientIdentification.existingPatient?.name || request.patientName || '',
          doctorId,
          doctorName: doctor.name,
          clinicId,
          date: firestoreDateStr,
          time: getClinicTimeString(appointmentTime),
          arriveByTime: getClinicTimeString(arriveByTime),
          slotIndex,
          sessionIndex,
          status: 'Pending',
          paymentStatus: 'Unpaid',
          bookedVia: 'Advanced Booking',
          tokenNumber: (tokenResult?.tokenNumber ?? null) as any,
          numericToken: tokenResult?.numericToken,
          createdAt: getClinicNow(),
          updatedAt: getClinicNow()
        };

        if (source === 'phone') appt.notes = 'Booked via Phone';

        await this.appointmentRepo.save(appt, clinicId, transaction);
        return appt;
      });

      // ── SSE: Push real-time update to nurse dashboard ─────────────────────────
      // We emit 'walk_in_created' specifically because it triggers a silent 
      // refresh in the Nurse App dashboard, ensuring real-time visibility.
      this.sseService.emit('walk_in_created', appointment.clinicId, {
        appointment
      });

      return appointment;
    } catch (error: any) {
      // Catch ALREADY_EXISTS errors from createSlotLock during transaction commit
      if (error.code === 6 || error.message?.includes('ALREADY_EXISTS')) {
        console.warn(`[BookAdvancedAppointmentUseCase] Slot already occupied (Lock Collision): ${lockId}`);
        throw new SlotAlreadyBookedError();
      }
      throw error;
    }
  }
}
