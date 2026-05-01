import { IUserRepository } from '../domain/repositories';

export class DeleteUserUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(id: string, clinicId?: string, soft: boolean = true): Promise<void> {
    // If clinicId is provided (staff action), pass it. If null (Superadmin), pass 'SYSTEM' or handle it.
    // Given Rule 15, we must pass the clinicId to the repository.
    return this.userRepo.delete(id, clinicId || 'SYSTEM', soft);
  }
}
