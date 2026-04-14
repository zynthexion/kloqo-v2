import * as admin from 'firebase-admin';
import { User, RBACUtils, KLOQO_ROLES, KloqoRole } from '@kloqo/shared';
import { IUserRepository, IEmailService, IClinicRepository } from '../domain/repositories';

export class CreateUserUseCase {
  constructor(
    private userRepo: IUserRepository,
    private emailService?: IEmailService,
    private clinicRepo?: IClinicRepository
  ) {}

  private generateTempPassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure it meets standard requirements: 1 uppercase, 1 lowercase, 1 number
    if (!/[A-Z]/.test(password)) password += 'A';
    if (!/[a-z]/.test(password)) password += 'a';
    if (!/[0-9]/.test(password)) password += '1';
    return password;
  }

  async execute(params: { 
    email: string; 
    password?: string; 
    name: string; 
    role: User['role'];
    phone?: string;
    clinicId?: string;
    accessibleMenus?: string[];
    assignedDoctorIds?: string[];
  }): Promise<User> {
    const { email, name, phone, clinicId, accessibleMenus, assignedDoctorIds } = params;
    let { role, password } = params;

    // Standardize roles to unified camelCase identifiers
    const normalizedRoles = RBACUtils.getNormalizedRoles({ role } as any);
    if (normalizedRoles.length > 0) {
      role = normalizedRoles[0];
    }

    // Generate a temporary password if not provided (common for staff/nurse added by admin)
    const isGeneratedPassword = !password;
    if (isGeneratedPassword) {
      password = this.generateTempPassword();
      console.log(`[CreateUserUseCase] Generated temp password for ${email}: ${password}`);
    }

    let uid: string;
    let isNewAuthUser = false;

    try {
      // 1. Try to create in Firebase Auth
      const authUser = await admin.auth().createUser({
        email,
        password,
        displayName: name,
        phoneNumber: phone || undefined,
      });
      uid = authUser.uid;
      isNewAuthUser = true;
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        // If user already exists, get their UID
        const existingUser = await admin.auth().getUserByEmail(email);
        uid = existingUser.uid;
      } else {
        throw error;
      }
    }

    // 🛡️ ADDITIVE RBAC: Check for existing user and merge roles
    const userRef = admin.firestore().collection('users').doc(uid);
    const existingUserDoc = await userRef.get();
    const existingRoles = existingUserDoc.exists ? (existingUserDoc.data()?.roles || [existingUserDoc.data()?.role]) : [];

    const mergedRoles = Array.from(new Set([
      ...existingRoles,
      role
    ])).filter(Boolean) as KloqoRole[];

    const newUser: Partial<User> = {
      id: uid,
      email,
      name,
      role, // The newly assigned role is treated as primary for this context
      roles: mergedRoles,
      clinicId,
      updatedAt: new Date(),
      isDeleted: false
    };

    if (!existingUserDoc.exists) {
      newUser.createdAt = new Date();
    }

    if (phone) {
      newUser.phone = phone;
    }

    // Database Optimization: Do not store accessibleMenus for clinical staff 
    // (nurse, pharmacist, receptionist) as they never use the Clinic Admin app.
    // They are hardcoded to operational roles in the frontend apps.
    const isDashboardAdmin = RBACUtils.hasAnyRole({ role } as any, [KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN]);
    if (isDashboardAdmin && accessibleMenus) {
      newUser.accessibleMenus = accessibleMenus;
    }

    if (assignedDoctorIds) {
      newUser.assignedDoctorIds = assignedDoctorIds;
    }

    await userRef.set(newUser, { merge: true });

    // 2. Send Credentials Email if new user and email service is available
    if (isNewAuthUser && this.emailService && password) {
      try {
        let clinicName: string | undefined;
        if (clinicId && this.clinicRepo) {
          const clinic = await this.clinicRepo.findById(clinicId);
          clinicName = clinic?.name;
        }

        await this.emailService.sendCredentials(
          email,
          name,
          password,
          role,
          clinicName
        );
      } catch (emailError) {
        console.error('Failed to send welcome email to user:', emailError);
      }
    }

    return newUser as User;
  }
}
