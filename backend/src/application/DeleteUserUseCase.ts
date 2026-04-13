import { IUserRepository } from '../domain/repositories';

export class DeleteUserUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(id: string, soft: boolean = true): Promise<void> {
    return this.userRepo.delete(id, soft);
  }
}
