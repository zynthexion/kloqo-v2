import { IDepartmentRepository } from '../domain/repositories';
import { Department, PaginationParams, PaginatedResponse } from '../../../packages/shared/src/index';

export class GetAllDepartmentsUseCase {
  constructor(private departmentRepo: IDepartmentRepository) {}

  async execute(params?: PaginationParams): Promise<PaginatedResponse<Department> | Department[]> {
    return this.departmentRepo.findAll(params);
  }
}
