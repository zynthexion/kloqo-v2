import { IDoctorRepository, IUserRepository, IAuthService } from '../domain/repositories';

export class RevokeDoctorAccessUseCase {
  constructor(
    private doctorRepo: IDoctorRepository,
    private userRepo: IUserRepository,
    private authService: IAuthService
  ) {}

  async execute(doctorId: string, clinicId: string): Promise<void> {
    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor) throw new Error('Doctor not found');
    if (doctor.clinicId !== clinicId) throw new Error('Unauthorized');

    if (!doctor.email) {
      throw new Error('Doctor does not have an email associated with an account');
    }

    const user = await this.userRepo.findByEmail(doctor.email);
    if (!user) {
      throw new Error('No user account found for this doctor');
    }

    const userId = user.id || user.uid;

    try {
      if (user.uid) {
        await this.authService.deleteUser(user.uid);
      }
    } catch (error: any) {
      console.warn("Could not delete from Auth (might already be deleted):", error.message);
    }

    await this.userRepo.delete(userId as string, false); // Hard delete from Firestore

    // Also clear the accessibleMenus on the doctor to reflect "no access" if someone looks at it
    doctor.accessibleMenus = [];
    await this.doctorRepo.save(doctor);
  }
}

