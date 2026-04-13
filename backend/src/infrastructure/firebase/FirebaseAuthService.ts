import { IAuthService, AuthResponse, IClinicRepository, IPatientRepository } from '../../domain/repositories';
import { IUserRepository } from '../../domain/repositories';
import { User } from '@kloqo/shared';
import * as admin from 'firebase-admin';

export class FirebaseAuthService implements IAuthService {
  constructor(
    private userRepo: IUserRepository,
    private clinicRepo: IClinicRepository,
    private patientRepo: IPatientRepository
  ) {}

  async login(email: string, password: string, appSource?: string): Promise<AuthResponse> {
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      throw new Error('FIREBASE_WEB_API_KEY not configured on backend.');
    }

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(data.error?.message || 'Login failed');
    }

    const user = await this.userRepo.findById(data.localId);
    if (!user) {
      throw new Error('User record not found in database.');
    }

    // Role-based app restriction
    if (appSource === 'clinic-admin') {
      if (user.role !== 'superAdmin' && user.role !== 'clinicAdmin') {
        throw new Error('Unauthorized: This account cannot access the Clinic Admin portal.');
      }
    } else if (appSource === 'nurse-app') {
      // Allowed clinical roles for the nurse/tablet app
      const allowedRoles: User['role'][] = ['nurse', 'doctor', 'receptionist', 'clinicAdmin'];
      if (!allowedRoles.includes(user.role)) {
        throw new Error('Unauthorized: This account cannot access the clinical application.');
      }
    }

    // V2 Logic: Check clinic registration status if clinicId is present
    if (user.clinicId) {
      const clinic = await this.clinicRepo.findById(user.clinicId);
      if (clinic) {
        // We now allow Pending and Rejected clinics to log in so the frontend
        // OnboardingCheck component can catch them and show the visual UI.
      }
    }

    return {
      status: 'success',
      user,
      token: data.idToken
    };
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      let user = await this.userRepo.findById(decodedToken.uid) as any;
      
      if (!user && this.patientRepo) {
        user = await this.patientRepo.findById(decodedToken.uid) as any;
      }
      
      if (!user) {
        throw new Error('User/Patient not found');
      }

      // 1. GOD MODE OVERRIDE
      // If the token contains impersonation claims, prioritize them over the DB record.
      // This allows Super Admins (who have clinicId: null in DB) to "act" as a clinic.
      if (decodedToken.isImpersonating && decodedToken.clinicId) {
          user.clinicId = decodedToken.clinicId;
          user.roles = decodedToken.roles || user.roles;
          user.role = decodedToken.role || user.role;
          user.isImpersonating = true;
          console.log(`[AUTH] God Mode active for ${user.email} -> Acting as ${user.clinicId}`);
      }

      // Auto-link patientId if missing but patient profile exists (syncs after manual registration)
      if (user && !user.patientId && user.phone) {
          try {
              const patients = await this.patientRepo.findByPhone(user.phone);
              if (patients.length > 0) {
                  const primary = patients.find((p: any) => p.isPrimary) || patients[0];
                  user.patientId = primary.id;
                  await this.userRepo.save(user);
                  console.log(`[verifyToken] Auto-linked patient profile ${primary.id} to user ${user.id}`);
              }
          } catch (e) {
              console.warn('[verifyToken] Could not auto-link patient profile:', e);
          }
      }
      
      return user;
    } catch (error: any) {
      console.error('Firebase token verification failed:', error);
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  async createUser(email: string, password: string, role: User['role'], clinicId: string, name: string, phone?: string, accessibleMenus?: string[]): Promise<User> {
    try {
      // 1. Create User in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: name,
        phoneNumber: phone || undefined,
      });

      // 2. Create User record in Firestore/Database
      const userData: User = {
        id: userRecord.uid,
        email,
        name,
        role,
        roles: [role],
        clinicId,
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (phone) {
        userData.phone = phone;
      }
      
      // Database Optimization: Skip accessibleMenus for clinical roles
      if (role !== 'doctor' && role !== 'nurse') {
        if (accessibleMenus) {
          userData.accessibleMenus = accessibleMenus;
        }
      }

      await this.userRepo.save(userData);
      return userData;
    } catch (error: any) {
      console.error('Firebase user creation failed:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async updatePassword(uid: string, newPassword: string): Promise<void> {
    try {
      await admin.auth().updateUser(uid, {
        password: newPassword
      });
    } catch (error: any) {
      console.error('Firebase password update failed:', error);
      throw new Error(`Failed to update password: ${error.message}`);
    }
  }

  async deleteUser(uid: string): Promise<void> {
    try {
      await admin.auth().deleteUser(uid);
    } catch (error: any) {
      console.error('Firebase user deletion failed:', error);
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  async loginWithPhone(phone: string): Promise<AuthResponse> {
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      throw new Error('FIREBASE_WEB_API_KEY not configured on backend.');
    }

    try {
      // 1. Get or Create Firebase User by Phone
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByPhoneNumber(phone);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          userRecord = await admin.auth().createUser({
            phoneNumber: phone,
          });
        } else {
          throw error;
        }
      }

      // 2. Generate Custom Token
      const customToken = await admin.auth().createCustomToken(userRecord.uid);

      // 3. Exchange Custom Token for ID Token via REST API
      const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
          token: customToken,
          returnSecureToken: true
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json() as any;
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to exchange custom token for ID token');
      }

      // 4. Ensure User record exists in our DB and has patientId linked
      let user = await this.userRepo.findById(userRecord.uid);
      
      // Look for existing patient profile
      let existingPatientId: string | null = null;
      try {
        const patients = await this.patientRepo.findByPhone(phone);
        if (patients.length > 0) {
          const primary = patients.find((p: any) => p.isPrimary) || patients[0];
          existingPatientId = primary.id;
        }
      } catch (e) {
        console.warn('[loginWithPhone] Could not search existing patients:', e);
      }

      if (!user) {
        const newUser: User = {
          id: userRecord.uid,
          role: 'patient',
          roles: ['patient'],
          phone: phone,
          name: 'Patient User',
          patientId: existingPatientId || undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await this.userRepo.save(newUser);
        user = newUser;
      } else if (!user.patientId && existingPatientId) {
        // Link existing patientId to existing user if not already linked
        user.patientId = existingPatientId;
        await this.userRepo.save(user);
      }
 
       return {
         status: 'success',
         user,
         token: data.idToken
       };
    } catch (error: any) {
      console.error('Login with phone failed:', error);
      throw new Error(`Auth failed: ${error.message}`);
    }
  }
}
