import { IPatientRepository } from '../domain/repositories';
import { Patient } from '../../../packages/shared/src/index';

export class GetLinkPendingPatientsUseCase {
  constructor(private patientRepo: IPatientRepository) {}

  async execute(clinicId: string): Promise<Patient[]> {
    return this.patientRepo.findLinkPending(clinicId);
  }
}
