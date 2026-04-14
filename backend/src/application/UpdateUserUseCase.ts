import { IUserRepository } from '../domain/repositories';
import { User, KloqoRole } from '@kloqo/shared';
import { ForbiddenError, NotFoundError } from '../domain/errors';

export class UpdateUserUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(id: string, data: Partial<User>, adminClinicId?: string): Promise<User> {
    const targetUser = await this.userRepo.findById(id);
    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    // 🚨 SECURITY GUARD: Tenant Isolation (Rule 15)
    // Ensure the administrator modifying the user belongs to the same clinic as the target.
    // Super admins (who have no clinicId) are exempt from this check.
    if (adminClinicId && targetUser.clinicId && targetUser.clinicId !== adminClinicId) {
      throw new ForbiddenError('Tenant Violation: You do not have permission to modify staff from other clinics.');
    }

    // 🧱 DATA HYGIENE: Dual-Write Role Logic
    // If we are updating roles (array), ensure the primary 'role' (string) is synchronized.
    if (data.roles && data.roles.length > 0) {
      data.role = data.roles[0] as KloqoRole;
    } else if (data.role && !data.roles) {
      // If updating legacy role only, wrap it into the roles array
      data.roles = [data.role as KloqoRole];
    }

    await this.userRepo.update(id, data);
    
    // Fetch and return the fully updated user for zero-latency UI updates
    const updatedUser = await this.userRepo.findById(id);
    if (!updatedUser) throw new NotFoundError('Update failed: User disappeared');
    
    return updatedUser;
  }
}
