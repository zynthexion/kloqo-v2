import { IPatientRepository } from '../domain/repositories';
import { Patient } from '../../../packages/shared/src/index';

export class SearchPatientsByPhoneUseCase {
  constructor(private patientRepo: IPatientRepository) {}

  async execute(phone: string, clinicId: string): Promise<Patient[]> {
    if (!phone || phone.length < 10) return [];
    
    // Normalize phone to +91XXXXXXXXXX
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    const fullPhone = `+91${cleaned}`;
    
    const [byPhone, byComm] = await Promise.all([
      this.patientRepo.findByPhone(fullPhone),
      this.patientRepo.findByCommunicationPhone(fullPhone)
    ]);

    const combined = [...byPhone, ...byComm];
    // Deduplicate by ID
    const unique = Array.from(new Map(combined.map(p => [p.id, p])).values());
    
    // Sort so that patients belonging to THIS clinic come first
    return unique.sort((a, b) => {
      const aIsLocal = a.clinicIds?.includes(clinicId);
      const bIsLocal = b.clinicIds?.includes(clinicId);
      if (aIsLocal && !bIsLocal) return -1;
      if (!aIsLocal && bIsLocal) return 1;
      return 0;
    });
  }
}
