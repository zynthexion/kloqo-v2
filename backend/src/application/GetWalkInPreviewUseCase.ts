import { addMinutes } from 'date-fns';
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
  isPriority?: boolean;
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
      console.warn(`[WalkInPreview] No active session found for doctor ${dto.doctorId} at ${now.toISOString()}`);
      throw new Error('No active session found for walk-in preview.');
    }

    const tokenDistribution = (doctor as any).tokenDistribution || (clinic as any).tokenDistribution || 'advanced';

    // 1. PEEK: Get the next available token without burning it (burn happens in CreateWalkInUseCase)
    const { tokenNumber, numericToken } = await this.tokenGenerator.peekToken(
      dto.clinicId,
      doctor.name,
      dto.date,
      'W',
      activeSessionIndex,
      tokenDistribution,
      slots.filter(s => s.sessionIndex === activeSessionIndex).length,
      dto.isPriority
    );

    console.log(`[WalkInPreview] Debug:`, {
      activeSessionIndex,
      tokenPreview: tokenNumber,
      isPriority: dto.isPriority,
      distribution: tokenDistribution
    });

    const sessionSlots = slots.filter(s => s.sessionIndex === activeSessionIndex);

    const advanceApps: SchedulerAdvance[] = allAppointments
      .filter(a => a.bookedVia !== 'Walk-in' && a.status !== 'Cancelled')
      .map(a => ({ id: `__shiftable_${a.id}`, slotIndex: a.slotIndex! }));

    console.log(`[WalkInPreview] Input Summary:`, {
      totalSlots: sessionSlots.length,
      advanceCount: advanceApps.length,
      existingWalkInCount: allAppointments.filter(a => a.bookedVia === 'Walk-in').length
    });

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
      walkInTokenAllotment: (doctor as any).walkInTokenAllotment || (clinic as any).walkInTokenAllotment || 0,
      advanceAppointments: advanceApps,
      walkInCandidates: [...existingWalkIns, newWalkInCandidate]
    });

    let newAssignment = assignments.find(a => a.id === '__new_walk_in__');
    
    // 🚑 OVERTIME FALLBACK: If the session is full, suggest the next logical overtime slot
    if (!newAssignment) {
      const maxOccupiedIndex = allAppointments.length > 0 
        ? Math.max(...allAppointments.filter(a => typeof a.slotIndex === 'number').map(a => a.slotIndex!))
        : -1;
      
      const lastSessionSlot = sessionSlots[sessionSlots.length - 1];
      const overtimeIndex = Math.max(lastSessionSlot.index, maxOccupiedIndex) + 1;
      const avgConsultTime = (doctor as any).averageConsultingTime || 15;
      const virtualTime = addMinutes(lastSessionSlot.time, avgConsultTime * (overtimeIndex - lastSessionSlot.index));

      newAssignment = {
        id: '__new_walk_in__',
        slotIndex: overtimeIndex,
        sessionIndex: activeSessionIndex,
        slotTime: virtualTime
      };
    }

    const advanceShifts = assignments
      .filter(a => a.id.startsWith('__shiftable_'))
      .map(a => ({
        appointmentId: a.id.replace('__shiftable_', ''),
        newSlotIndex: a.slotIndex,
        newTime: a.slotTime
      }));

    return {
      placeholderAssignment: {
        ...newAssignment,
        numericToken
      },
      advanceShifts
    };
  }
}
