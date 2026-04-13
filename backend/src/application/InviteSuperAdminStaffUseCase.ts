import { User } from '../../../packages/shared/src/index';
import { IAuthService, IUserRepository, IEmailService } from '../domain/repositories';
import * as crypto from 'crypto';

export class InviteSuperAdminStaffUseCase {
  constructor(
    private authService: IAuthService,
    private userRepo: IUserRepository,
    private emailService: IEmailService
  ) {}

  async execute(email: string, name: string, accessibleMenus: string[]): Promise<User> {
    // 1. Generate 12-character temporary password
    const tempPassword = crypto.randomBytes(8).toString('base64').slice(0, 12);

    // 2. Create the user in Auth + DB
    // Super Admin staff are also GLOBAL (no specific clinicId)
    const user = await this.authService.createUser(
      email,
      tempPassword,
      'superAdmin', // Role from shared type
      'GLOBAL',
      name,
      undefined,
      accessibleMenus
    );

    // 3. Force password reset on first login
    await this.userRepo.update(user.id!, { mustChangePassword: true });

    // 4. Send Invitation Email
    await this.emailService.sendCredentials(
      email,
      name,
      tempPassword,
      'Super Admin Staff',
      'Kloqo Super Admin Portal'
    );

    return { ...user, mustChangePassword: true };
  }
}
