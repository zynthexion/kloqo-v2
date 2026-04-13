import { IDepartmentRepository } from '../domain/repositories';

export class DeleteDepartmentUseCase {
  constructor(private departmentRepo: IDepartmentRepository) {}

  async execute(id: string, soft: boolean = true): Promise<void> {
    return this.departmentRepo.delete(id, soft);
  }
}
