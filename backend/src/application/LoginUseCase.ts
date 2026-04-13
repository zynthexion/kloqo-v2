import { IAuthService, AuthResponse } from '../domain/repositories';
import * as jwt from 'jsonwebtoken';

export class LoginUseCase {
  constructor(private authService: IAuthService) {}

  async execute(email: string, password: string, appSource?: string): Promise<AuthResponse> {
    const response = await this.authService.login(email, password, appSource);

    // If login is successful, check if the user is required to reset their password
    if (response.status === 'success' && response.user.mustChangePassword) {
      const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
      
      // Generate a short-lived token (15 mins) for the password reset flow
      const resetToken = jwt.sign(
        { 
          uid: response.user.id,
          email: response.user.email,
          appSource: appSource || 'nurse-app',
          purpose: 'password_reset' 
        }, 
        jwtSecret, 
        { expiresIn: '15m' }
      );

      return {
        status: 'requires_reset',
        email: response.user.email || '',
        resetToken
      };
    }

    return response;
  }
}
