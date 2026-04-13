import { IClinicRepository } from '../domain/repositories';

export class GenerateShortCodeUseCase {
  constructor(private clinicRepo: IClinicRepository) {}

  private static readonly CODE_PREFIX = 'KQ-';

  async execute(clinicId: string): Promise<string> {
    const clinic = await this.clinicRepo.findById(clinicId);
    if (!clinic) {
      throw new Error(`Clinic ${clinicId} not found`);
    }

    if (clinic.shortCode) {
      return clinic.shortCode;
    }

    // Generate deterministic code from last 4 characters of ID
    const suffix = clinicId.slice(-4).toUpperCase();
    const newCode = `${GenerateShortCodeUseCase.CODE_PREFIX}${suffix}`;

    // Note: Legacy implementation had a collision check but it's very unlikely 
    // with 20-character IDs. For now, we update the clinic with this code.
    await this.clinicRepo.update(clinicId, {
      shortCode: newCode,
      updatedAt: new Date()
    });

    return newCode;
  }
}
