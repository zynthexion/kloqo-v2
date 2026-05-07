import { IAppointmentRepository } from '../domain/repositories';
import { Appointment } from '../../../packages/shared/src/index';

/**
 * GetPendingConflictsUseCase
 * 
 * Fetches all appointments in a clinic that are flagged as PENDING conflicts.
 * These are shown in the Nurse Dashboard's "Action Center".
 */
export class GetPendingConflictsUseCase {
  constructor(private appointmentRepo: IAppointmentRepository) {}

  async execute(clinicId: string): Promise<Appointment[]> {
    if (!clinicId) throw new Error('Clinic ID is required');
    return this.appointmentRepo.findConflictsByClinic(clinicId);
  }
}
