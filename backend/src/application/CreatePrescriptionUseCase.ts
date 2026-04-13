import { Prescription } from '../../../packages/shared/src/index';
import { IPrescriptionRepository } from '../domain/repositories';

export class CreatePrescriptionUseCase {
  constructor(private prescriptionRepo: IPrescriptionRepository) {}

  async execute(prescription: Prescription): Promise<void> {
    if (!prescription.clinicId) throw new Error('Clinic ID is required');
    if (!prescription.patientId) throw new Error('Patient ID is required');
    if (!prescription.doctorId) throw new Error('Doctor ID is required');
    
    return this.prescriptionRepo.save(prescription);
  }
}
