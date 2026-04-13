import { IDoctorRepository, IUserRepository, IAuthService, IEmailService, IClinicRepository } from '../domain/repositories';
import { Doctor, User, KLOQO_ROLES } from '../../../packages/shared/src/index';

export class SaveDoctorUseCase {
  constructor(
    private doctorRepo: IDoctorRepository,
    private userRepo: IUserRepository,
    private authService: IAuthService,
    private emailService: IEmailService,
    private clinicRepo: IClinicRepository
  ) {}

  private generateTempPassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!/[A-Z]/.test(password)) password += 'A';
    if (!/[a-z]/.test(password)) password += 'a';
    if (!/[0-9]/.test(password)) password += '1';
    return password;
  }

  async execute(doctor: Doctor): Promise<void> {
    // 1. Check-then-Act (Rule 10): determine NEW vs EDIT before any write.
    const existingDoctor = await this.doctorRepo.findById(doctor.id);
    const isNewDoctor = !existingDoctor;

    // 2. Extract roles/access before saving (Clinical normalization)
    const { roles, role, accessibleMenus, ...doctorDataOnly } = doctor as any;
    
    console.log('[SaveDoctorUseCase] Doctor data after normalization:', JSON.stringify(doctorDataOnly, null, 2));

    // 3. Save doctor data (WITHOUT roles, role, or menu fields)
    await this.doctorRepo.save(doctorDataOnly as Doctor);
    console.log('[SaveDoctorUseCase] Successfully saved doctor:', doctorDataOnly.id);

    // 4. Synchronize roles to User collection
    if (doctor.email) {
      const associatedUser = await this.userRepo.findByEmail(doctor.email);
      if (associatedUser) {
        // ✅ LINK IDENTITY: Ensure the Doctor doc has the user's ID
        await this.doctorRepo.update(doctor.id, { userId: associatedUser.id });
        
        await this.userRepo.update(associatedUser.id!, {
          roles: roles || associatedUser.roles || [KLOQO_ROLES.DOCTOR],
          role: role || (roles?.[0]) || associatedUser.role || KLOQO_ROLES.DOCTOR
        });
      }
    }

    // 5. If new doctor, atomically increment the clinic's doctor count.
    if (isNewDoctor) {
      await this.clinicRepo.incrementDoctorCount(doctor.clinicId, 1);
    }

    // 6. If new doctor and has email, create user credentials (if not exists).
    if (isNewDoctor && doctor.email) {
      const existingUser = await this.userRepo.findByEmail(doctor.email);

      if (!existingUser) {
        const tempPassword = this.generateTempPassword();
        const phone = doctor.phone || doctor.mobile || '';
        
        try {
          const newUser = await this.authService.createUser(
            doctor.email,
            tempPassword,
            KLOQO_ROLES.DOCTOR,
            doctor.clinicId,
            doctor.name,
            phone,
            roles || [KLOQO_ROLES.DOCTOR] // Pass roles array to auth service
          );

          // ✅ LINK IDENTITY: Stamp the newly created userId on the Doctor document
          await this.doctorRepo.update(doctor.id, { userId: newUser.id });

          const clinic = await this.clinicRepo.findById(doctor.clinicId);
          await this.emailService.sendCredentials(
            doctor.email,
            doctor.name,
            tempPassword,
            KLOQO_ROLES.DOCTOR,
            clinic?.name
          );
        } catch (error: any) {
          if (!error.message.includes('already in use')) {
            throw error;
          }
        }
      }
    }
  }
}
