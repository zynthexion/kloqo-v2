import { User } from '../../../packages/shared/src/index';
import { IAuthService, IUserRepository, AuthResponse } from '../domain/repositories';
import * as jwt from 'jsonwebtoken';

export class ForcePasswordResetUseCase {
  constructor(
    private authService: IAuthService,
    private userRepo: IUserRepository
  ) {}

  async execute(resetToken: string, newPassword: string): Promise<AuthResponse> {
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';

    try {
      // 1. Verify the Reset Token
      const decoded = jwt.verify(resetToken, jwtSecret) as any;
      if (decoded.purpose !== 'password_reset') {
        throw new Error('Invalid token purpose');
      }

      const uid = decoded.uid;
      const email = decoded.email;
      const appSource = decoded.appSource || 'nurse-app';

      // 2. Update Password in Firebase Auth
      await this.authService.updatePassword(uid, newPassword);

      // 3. Clear the mustChangePassword flag in Firestore
      await this.userRepo.update(uid, { 
        mustChangePassword: false,
        updatedAt: new Date()
      });

      // 4. Perform a fresh login to get the full session token
      // This returns the final { status, token, user } object directly to the front-end
      return this.authService.login(email, newPassword, appSource);

    } catch (error: any) {
       console.error('[ForcePasswordReset] Failed:', error.message);
       throw new Error('Invalid or expired reset token. Please login again.');
    }
  }
}
