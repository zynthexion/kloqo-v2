import { IPatientRepository } from '../domain/repositories';

export class UnlinkRelativeUseCase {
  constructor(private patientRepo: IPatientRepository) {}

  async execute(primaryId: string, relativeId: string): Promise<void> {
    if (!primaryId || !relativeId) {
        throw new Error('PrimaryId and relativeId are required');
    }
    return this.patientRepo.unlinkRelative(primaryId, relativeId);
  }
}
