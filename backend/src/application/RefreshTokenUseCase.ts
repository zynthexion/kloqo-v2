import { IAuthService } from '../domain/repositories';

export class RefreshTokenUseCase {
  constructor(private authService: IAuthService) {}

  async execute(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    if (!refreshToken) {
      throw new Error('No refresh token provided');
    }
    return this.authService.refreshToken(refreshToken);
  }
}
