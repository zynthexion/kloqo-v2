import { Appointment } from '../../../packages/shared/src/index';
import { 
  IAppointmentRepository, 
  IDoctorRepository, 
  IClinicRepository,
  IDBTransaction
} from '../domain/repositories';
import { ManagePatientUseCase } from './ManagePatientUseCase';
import { TokenStrategyFactory } from '../domain/services/token/TokenStrategyFactory';
import { format } from 'date-fns';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { BookingSessionEngine } from '../domain/services/BookingSessionEngine';
import { computeWalkInSchedule, SchedulerAdvance, SchedulerWalkInCandidate } from '../domain/services/SlotScheduler';
import { sseService } from '../domain/services/SSEService';
import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';

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
}

import { TokenGeneratorService } from '../domain/services/token/TokenGeneratorService';

export class CreateWalkInAppointmentUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository,
    private managePatientUseCase: ManagePatientUseCase,
    private tokenGenerator: TokenGeneratorService
  ) {}

  async execute(dto: CreateWalkInAppointmentDTO): Promise<Appointment> {
    const result = await db.runTransaction(async (txn) => {
      // --- FAIL FAST: Validate domain objects before any write operations ---
      const doctor = await this.doctorRepo.findById(dto.doctorId);
      if (!doctor) throw new Error('Doctor not found');

      const clinic = await this.clinicRepo.findById(dto.clinicId);
      if (!clinic) throw new Error('Clinic not found');

      const now = new Date();
      const allAppointments = await this.appointmentRepo.findByDoctorAndDate(dto.doctorId, dto.date);
      const slots = SlotCalculator.generateSlots(doctor, now);
      
      // ── Delegate session discovery to BookingSessionEngine (canonical) ─────
      // findActiveSession encapsulates the full Sticky + Jumping logic
      // mirroring the battle-tested legacy walk-in.service.ts logic.
      const activeSessionIndex = BookingSessionEngine.findActiveSession(
        doctor, slots, allAppointments, now, clinic.tokenDistribution || 'advanced'
      );

      if (activeSessionIndex === null) {
        throw new Error('No active session found for walk-in booking.');
      }

      const normalizedPhone = dto.phone
        ? dto.phone.replace(/\D/g, '').slice(-10)
        : '';

      // --- PATIENT MANAGEMENT: Participates in current transaction ---
      const patientId = await this.managePatientUseCase.execute({
        id: dto.patientId,
        name: dto.patientName,
        phone: normalizedPhone,
        communicationPhone: dto.communicationPhone,
        age: dto.age,
        sex: dto.sex,
        place: dto.place,
        clinicId: dto.clinicId,
      }, txn as unknown as IDBTransaction);

      // --- TOKEN GENERATION: Participates in current transaction ---
      const { tokenNumber, numericToken } = await this.tokenGenerator.generateToken(
        dto.clinicId,
        dto.doctorId,
        doctor.name,
        dto.date,
        'W',
        activeSessionIndex,
        clinic.tokenDistribution,
        txn as unknown as IDBTransaction
      );

      // --- ZIPPER SCHEDULING ---
      const sessionSlots = slots.filter(s => s.sessionIndex === activeSessionIndex);

      const advanceApps: SchedulerAdvance[] = allAppointments
        .filter(a => a.bookedVia !== 'Walk-in' && a.status !== 'Cancelled')
        .map(a => ({ id: `__shiftable_${a.id}`, slotIndex: a.slotIndex! }));

      const existingWalkIns: SchedulerWalkInCandidate[] = allAppointments
        .filter(a => a.bookedVia === 'Walk-in' && a.status !== 'Cancelled')
        .map(a => ({
          id: a.id,
          numericToken: a.numericToken!,
          createdAt: a.createdAt,
          currentSlotIndex: a.slotIndex
        }));

      const newWalkInCandidate: SchedulerWalkInCandidate = {
        id: '__new_walk_in__',
        numericToken,
        createdAt: new Date()
      };

      const { assignments } = computeWalkInSchedule({
        slots: sessionSlots,
        now,
        walkInTokenAllotment: clinic.walkInTokenAllotment || 0,
        advanceAppointments: advanceApps,
        walkInCandidates: [...existingWalkIns, newWalkInCandidate]
      });

      const newAssignment = assignments.find(a => a.id === '__new_walk_in__');
      if (!newAssignment) throw new Error('Could not schedule walk-in.');

      // Apply queue shifts atomically
      for (const assignment of assignments) {
        if (assignment.id.startsWith('__shiftable_')) {
          const originalId = assignment.id.replace('__shiftable_', '');
          await this.appointmentRepo.update(originalId, {
            slotIndex: assignment.slotIndex,
            time: format(assignment.slotTime, 'HH:mm'),
            updatedAt: new Date()
          }, txn as unknown as IDBTransaction);
        }
      }

      // --- CREATE APPOINTMENT ---
      const isClassic = clinic.tokenDistribution === 'classic';

      const appointment: Appointment = {
        id: `apt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        patientId,
        patientName: dto.patientName,
        doctorId: dto.doctorId,
        doctorName: doctor.name,
        clinicId: dto.clinicId,
        date: dto.date,
        time: format(newAssignment.slotTime, 'HH:mm'),
        status: 'Confirmed',
        tokenNumber,
        classicTokenNumber: isClassic ? tokenNumber : undefined,
        numericToken,
        bookedVia: 'Walk-in',
        slotIndex: newAssignment.slotIndex,
        sessionIndex: activeSessionIndex,
        arriveByTime: format(newAssignment.slotTime, 'HH:mm'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.appointmentRepo.save(appointment, txn as unknown as IDBTransaction);

      return appointment;
    });

    // ── SSE: Inform nurse dashboard of new walk-in instantly ──────────────────
    // This runs AFTER the transaction commits successfully.
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
}
