import { User, KLOQO_ROLES } from '../../../packages/shared/src/index';
import { IAuthService, IUserRepository } from '../domain/repositories';

export class RegisterInitialSuperAdminUseCase {
  constructor(
    private authService: IAuthService,
    private userRepo: IUserRepository
  ) {}

  async execute(email: string, password: string, name: string): Promise<User> {
    // 1. Fail Fast: Check if any superAdmin already exists
    const adminCount = await this.userRepo.countByRole(KLOQO_ROLES.SUPER_ADMIN);
    if (adminCount > 0) {
      throw new Error('Unauthorized: A primary Super Admin is already registered.');
    }

    // 2. Create the first Super Admin
    // Using an empty clinicId for global super admins
    const user = await this.authService.createUser(
      email,
      password,
      KLOQO_ROLES.SUPER_ADMIN,
      'GLOBAL', 
      name
    );

    // Initial super admin doesn't need to change password (they just set it)
    await this.userRepo.update(user.id!, { mustChangePassword: false });

    return user;
  }
}
