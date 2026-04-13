import { IDoctorRepository, IUserRepository } from '../domain/repositories';

export class UpdateDoctorAccessUseCase {
  constructor(
    private doctorRepo: IDoctorRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(doctorId: string, clinicId: string, accessibleMenus: string[]): Promise<void> {
    // 1. Find the doctor
    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor) {
      throw new Error('Doctor not found');
    }

    if (doctor.clinicId !== clinicId) {
      throw new Error('Unauthorized');
    }

    // 2. We no longer store custom accessibleMenus for Doctors.
    // Clinical roles now receive standardize, role-based menu defaults in the UI.
    console.log(`[UpdateDoctorAccessUseCase] Skipping menu update for doctor ${doctorId} (Clinical role standardization)`);
  }
}
