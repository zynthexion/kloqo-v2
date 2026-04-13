import { IPatientRepository } from '../domain/repositories';
import { Patient } from '../../../packages/shared/src/index';

export class GetPatientByIdUseCase {
  constructor(private patientRepo: IPatientRepository) {}

  async execute(id: string, clinicId: string): Promise<Patient | null> {
    if (!id || !clinicId) return null;
    return this.patientRepo.findById(id);
  }
}
