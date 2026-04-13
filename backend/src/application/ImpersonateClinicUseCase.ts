import * as admin from 'firebase-admin';
import { IClinicRepository } from '../domain/repositories';

export class ImpersonateClinicUseCase {
  constructor(private clinicRepo: IClinicRepository) {}

  /**
   * Generates a custom Firebase ID token for a Super Admin with 
   * tenant-specific claims (God Mode).
   */
  async execute(superAdminId: string, targetClinicId: string): Promise<string> {
    // 1. Rule 15: Verify the target clinic exists
    const clinic = await this.clinicRepo.findById(targetClinicId);
    if (!clinic) {
      throw new Error(`Impersonation Failed: Target Clinic ID ${targetClinicId} does not exist.`);
    }

    // 2. Define God Mode Claims
    // We include both 'superAdmin' (for global permission) 
    // and 'clinicAdmin' (for local UI guards to pass).
    const additionalClaims = {
      clinicId: targetClinicId,
      role: 'superAdmin',           // Legacy compatibility
      roles: ['superAdmin', 'clinicAdmin'], // Standardized Array RBAC
      isImpersonating: true,
      originalAdminId: superAdminId
    };

    // 3. Generate Custom Token via Firebase Admin
    try {
      const customToken = await admin.auth().createCustomToken(superAdminId, additionalClaims);
      
      // 4. Exchange Custom Token for ID Token via REST API
      // This allows the frontend to simply store the token and redirect without needing the Firebase SDK.
      const apiKey = process.env.FIREBASE_WEB_API_KEY;
      if (!apiKey) {
        throw new Error('FIREBASE_WEB_API_KEY not configured on backend.');
      }

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
        throw new Error(data.error?.message || 'Failed to exchange god-mode token.');
      }

      return data.idToken;
    } catch (error: any) {
      console.error('[GOD MODE] Failed to generate impersonation token:', error.message);
      throw new Error(`Impersonation Failed: ${error.message}`);
    }
  }
}
