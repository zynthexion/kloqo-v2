import { 
  IAppointmentRepository, 
  IDoctorRepository, 
  IClinicRepository 
} from '../domain/repositories';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { computeWalkInSchedule, SchedulerAdvance, SchedulerWalkInCandidate } from '../domain/services/SlotScheduler';

export interface WalkInPreviewDTO {
  clinicId: string;
  doctorId: string;
  date: string;
}

import { TokenGeneratorService } from '../domain/services/token/TokenGeneratorService';

export class GetWalkInPreviewUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository,
    private tokenGenerator: TokenGeneratorService
  ) {}

  async execute(dto: WalkInPreviewDTO) {
    const doctor = await this.doctorRepo.findById(dto.doctorId);
    if (!doctor) throw new Error('Doctor not found');

    const clinic = await this.clinicRepo.findById(dto.clinicId);
    if (!clinic) throw new Error('Clinic not found');

    const now = new Date();
    const allAppointments = await this.appointmentRepo.findByDoctorAndDate(dto.doctorId, dto.date);
    const slots = SlotCalculator.generateSlots(doctor, now);
    const activeSessionIndex = SlotCalculator.findActiveSessionIndex(
      doctor, slots, now, doctor.tokenDistribution || clinic.tokenDistribution || 'advanced'
    );

    if (activeSessionIndex === null) {
      throw new Error('No active session found for walk-in preview.');
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
    const advanceShifts = assignments
      .filter(a => a.id.startsWith('__shiftable_'))
      .map(a => ({
        appointmentId: a.id.replace('__shiftable_', ''),
        newSlotIndex: a.slotIndex,
        newTime: a.slotTime
      }));

    return {
      placeholderAssignment: newAssignment,
      advanceShifts
    };
  }
}
