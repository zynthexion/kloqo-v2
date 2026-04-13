import { IUserRepository, IPatientRepository } from '../domain/repositories';
import * as admin from 'firebase-admin';
import { KLOQO_ROLES } from '@kloqo/shared';

export class SyncPatientAuthUseCase {
  constructor(
    private userRepo: IUserRepository,
    private patientRepo: IPatientRepository
  ) {}

  async execute(token: string): Promise<{ user: any; isNew: boolean }> {
    if (!token) {
      throw new Error('No token provided');
    }

    // Verify token directly using admin SDK to bypass the V2 check that requires the user to exist
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, phone_number, name } = decodedToken;

    let user = await this.userRepo.findById(uid);
    let isNew = false;

    if (!user) {
      isNew = true;
      // Check if there's an existing patient with this phone number
      let existingPatientId: string | null = null;
      if (phone_number) {
        const existingPatients = await this.patientRepo.findByPhone(phone_number);
        if (existingPatients.length > 0) {
          // Identify primary or first
          const primary = existingPatients.find(p => p.isPrimary) || existingPatients[0];
          existingPatientId = primary.id;
        }
      }

      // Create standard user document for the V2 backend to recognize them
      const newUser = {
        id: uid,
        role: KLOQO_ROLES.PATIENT,
        roles: [KLOQO_ROLES.PATIENT],
        phone: phone_number,
        name: name || 'Patient User',
        patientId: existingPatientId, // link to patient profile if exists
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.userRepo.save(newUser as any);
      user = newUser as any;
    }

    return { user, isNew };
  }
}
