import { 
  IAppointmentRepository, 
  IDoctorRepository, 
  IClinicRepository 
} from '../domain/repositories';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { computeWalkInSchedule, SchedulerAdvance, SchedulerWalkInCandidate } from '../domain/services/SlotScheduler';
import { format } from 'date-fns';

export interface WalkInEstimateDTO {
  clinicId: string;
  doctorId: string;
  date: string;
  force?: boolean;
}

import { TokenGeneratorService } from '../domain/services/token/TokenGeneratorService';

export class GetWalkInEstimateUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository,
    private tokenGenerator: TokenGeneratorService
  ) {}

  async execute(dto: WalkInEstimateDTO) {
    const doctor = await this.doctorRepo.findById(dto.doctorId);
    if (!doctor) throw new Error('Doctor not found');

    const clinic = await this.clinicRepo.findById(dto.clinicId);
    if (!clinic) throw new Error('Clinic not found');

    const now = new Date();
    const allAppointments = await this.appointmentRepo.findByDoctorAndDate(dto.doctorId, dto.date);
    const slots = SlotCalculator.generateSlots(doctor, now);
    const activeSessionIndex = SlotCalculator.findActiveSessionIndex(
      doctor, slots, now, doctor.tokenDistribution || clinic.tokenDistribution || 'advanced', allAppointments
    );

    if (activeSessionIndex === null) {
      return { unavailable: true, reason: 'No active session' };
    }

    const { numericToken } = await this.tokenGenerator.generateToken(
      dto.clinicId,
      dto.doctorId,
      doctor.name,
      dto.date,
      'W',
      activeSessionIndex,
      doctor.tokenDistribution || clinic.tokenDistribution
    );

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
      walkInTokenAllotment: doctor.walkInTokenAllotment || clinic.walkInTokenAllotment || 0,
      advanceAppointments: advanceApps,
      walkInCandidates: [...existingWalkIns, newWalkInCandidate]
    });

    const newAssignment = assignments.find(a => a.id === '__new_walk_in__');
    if (!newAssignment) throw new Error('Could not schedule walk-in for estimate.');

    const patientsAhead = assignments.filter(a => 
      a.id !== '__new_walk_in__' && 
      !a.id.startsWith('__shiftable_') && 
      a.slotIndex < newAssignment.slotIndex
    ).length;

    return {
      estimatedTime: newAssignment.slotTime,
      actualSlotTime: newAssignment.slotTime,
      patientsAhead,
      numericToken,
      slotIndex: newAssignment.slotIndex,
      sessionIndex: activeSessionIndex
    };
  }
}
