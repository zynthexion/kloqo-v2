import { IUserRepository } from '../domain/repositories';
import { User } from '@kloqo/shared';

export class CheckUserByEmailUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(email: string): Promise<User | null> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;
    
    // Safety check: only allow clinicAdmin to be checked for forgot password in this app context
    if (user.role !== 'clinicAdmin') {
      return null;
    }
    
    return user;
  }
}
