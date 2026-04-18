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
import { parseClinicTime, parseClinicDate, getClinicDateString } from '../domain/services/DateUtils';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { SlotAlreadyBookedError, DuplicateBookingError } from '../domain/errors';

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
}

import { TokenGeneratorService } from '../domain/services/token/TokenGeneratorService';

export class BookAdvancedAppointmentUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private patientRepo: IPatientRepository,
    private clinicRepo: IClinicRepository,
    private managePatientUseCase: ManagePatientUseCase,
    private tokenGenerator: TokenGeneratorService
  ) {}

  async execute(request: BookAdvancedAppointmentRequest): Promise<Appointment> {
    const { clinicId, doctorId, slotIndex, sessionIndex, source } = request;
    const patientId = request.patientId || undefined; // Prevents documentPath "" error
    const slotTime = request.slotTime || (request as any).time;

    console.log('[BookAdvancedAppointmentUseCase] START', { clinicId, doctorId, patientId, slotTime, slotIndex, sessionIndex });

    // Normalize Date to legacy format "d MMMM yyyy" for repository parity
    const incomingDate = request.date;
    const date = incomingDate.includes('-') 
      ? parseClinicDate(incomingDate) 
      : parse(incomingDate, 'd MMMM yyyy', new Date());
    
    const firestoreDateStr = getClinicDateString(date);

    // --- FAIL FAST: Validate all inputs ---
    if (!doctorId) {
        console.error('[BookAdvancedAppointmentUseCase] Error: doctorId is empty');
        throw new Error('Doctor ID is required');
    }
    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor) throw new Error('Doctor not found');

    if (!clinicId) {
        console.error('[BookAdvancedAppointmentUseCase] Error: clinicId is empty');
        throw new Error('Clinic ID is required');
    }
    const clinic = await this.clinicRepo.findById(clinicId);
    if (!clinic) throw new Error('Clinic not found');

    // --- PATIENT MANAGEMENT ---
    const finalPatientId = await this.managePatientUseCase.execute({
      id: patientId,
      name: request.patientName || '',
      phone: request.phone || '',
      age: request.age,
      sex: request.sex,
      place: request.place,
      communicationPhone: request.communicationPhone,
      clinicId: clinicId
    });

    console.log('[BookAdvancedAppointmentUseCase] Patient managed:', finalPatientId);

    if (!finalPatientId) {
        console.error('[BookAdvancedAppointmentUseCase] Error: finalPatientId is empty after management');
        throw new Error('Internal Error: Patient identification failed');
    }
    const patient = await this.patientRepo.findById(finalPatientId);
    if (!patient) throw new Error('Patient not found after management');
    const patientName = patient.name;

    // --- STRATEGY PATTERN: Factory picks the correct token strategy ---
    const tokenStrategy = TokenStrategyFactory.create(clinic.tokenDistribution, this.tokenGenerator);

    // Calculate Arrive By Time (15 mins before)
    const appointmentTime = parseClinicTime(slotTime, date);
    const arriveByTime = subMinutes(appointmentTime, 15);
    
    // Create new deterministic Object ID
    const appointmentId = `apt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Generate Lock ID
    const lockId = `${doctorId}_${firestoreDateStr}_s${sessionIndex}_slot${slotIndex}`;

    const appointment = await this.appointmentRepo.runTransaction(async (transaction) => {
      // 0. Duplicate Check: same person in same session is a duplicate booking.
      // We check active appointments (non-cancelled) for this patient on this date/session.
      const existingAppts = await this.appointmentRepo.findByDoctorAndDate(doctorId, firestoreDateStr);
      const isDuplicate = existingAppts.some(a => 
        a.patientId === finalPatientId && 
        a.sessionIndex === sessionIndex && 
        a.status !== 'Cancelled'
      );
      
      if (isDuplicate) {
        console.warn(`[BookAdvancedAppointmentUseCase] Duplicate booking blocked for patient ${finalPatientId} in session ${sessionIndex}`);
        throw new DuplicateBookingError();
      }

      // 1. Lock the Slot (Fails automatically if already exists)
      try {
        await this.appointmentRepo.createSlotLock(lockId, {
          appointmentId,
          doctorId,
          date: firestoreDateStr,
          sessionIndex,
          slotIndex
        }, transaction);
      } catch (error: any) {
        // Code 6 is ALREADY_EXISTS in Firestore
        if (error.code === 6 || error.message?.includes('ALREADY_EXISTS')) {
          console.warn(`[BookAdvancedAppointmentUseCase] Slot lock collision for ${lockId}`);
          throw new SlotAlreadyBookedError();
        }
        throw error;
      }

      // 2. Generate Token safely within the same transaction to prevent gaps on rejection
      const tokenResult = await tokenStrategy.generateBookingToken({
        clinicId,
        doctorId,
        doctorName: doctor.name,
        date: firestoreDateStr,
        sessionIndex,
      }, transaction);

      // 3. Create Appointment object
      const appt: Appointment = {
        id: appointmentId,
        patientId: finalPatientId,
        patientName: patientName!,
        doctorId,
        doctorName: doctor.name,
        clinicId,
        date: firestoreDateStr,
        time: format(appointmentTime, 'HH:mm'),
        arriveByTime: format(arriveByTime, 'HH:mm'),
        slotIndex,
        sessionIndex,
        status: 'Pending',
        paymentStatus: 'Unpaid',
        bookedVia: 'Advanced Booking',
        tokenNumber: (tokenResult?.tokenNumber ?? null) as any,
        numericToken: tokenResult?.numericToken,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (source === 'phone') {
        appt.notes = 'Booked via Phone';
      }

      // 4. Save Appointment within transaction
      await this.appointmentRepo.save(appt, transaction);
      return appt;
    });

    return appointment;
  }
}
