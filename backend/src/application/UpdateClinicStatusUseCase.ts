import { IClinicRepository } from '../domain/repositories';

export interface UpdateClinicStatusRequest {
  clinicId: string;
  status: 'Approved' | 'Rejected' | 'Pending';
}

export class UpdateClinicStatusUseCase {
  constructor(private clinicRepo: IClinicRepository) {}

  async execute(request: UpdateClinicStatusRequest): Promise<void> {
    await this.clinicRepo.update(request.clinicId, {
       registrationStatus: request.status,
       onboardingStatus: 'Pending', // Ensure it stays pending upon approval/change
       isDeleted: false
    } as any);
  }
}
