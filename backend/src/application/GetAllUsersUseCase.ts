import { IUserRepository } from '../domain/repositories';
import { User, PaginationParams, PaginatedResponse } from '../../../packages/shared/src/index';

export class GetAllUsersUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(params?: PaginationParams): Promise<PaginatedResponse<User> | User[]> {
    return this.userRepo.findAll(params);
  }
}
