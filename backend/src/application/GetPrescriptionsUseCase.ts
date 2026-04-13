import { Prescription } from '../../../packages/shared/src/index';
import { IPrescriptionRepository } from '../domain/repositories';

export class GetPrescriptionsUseCase {
  constructor(private prescriptionRepo: IPrescriptionRepository) {}

  async execute(clinicId: string): Promise<Prescription[]> {
    if (!clinicId) throw new Error('Clinic ID is required');
    return this.prescriptionRepo.findByClinicId(clinicId);
  }
}
