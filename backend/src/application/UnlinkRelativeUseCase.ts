import { IPatientRepository } from '../domain/repositories';

export class UnlinkRelativeUseCase {
  constructor(private patientRepo: IPatientRepository) {}

  async execute(primaryId: string, relativeId: string, clinicId: string): Promise<void> {
    if (!primaryId || !relativeId || !clinicId) {
        throw new Error('PrimaryId, relativeId and clinicId are required');
    }
    return this.patientRepo.unlinkRelative(primaryId, relativeId, clinicId);
  }
}
