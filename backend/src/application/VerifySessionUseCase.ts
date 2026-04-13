import { User } from '../../../packages/shared/src/index';
import { IAuthService } from '../domain/repositories';

export class VerifySessionUseCase {
  constructor(private authService: IAuthService) {}

  async execute(token: string | undefined): Promise<User> {
    if (!token) {
      throw new Error('No token provided');
    }

    // Handle "Bearer <token>" format
    const actualToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
    
    return this.authService.verifyToken(actualToken);
  }
}
