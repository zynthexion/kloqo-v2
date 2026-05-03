import { IDepartmentRepository } from '../domain/repositories';
import { Department } from '../../../packages/shared/src/index';

export class UpdateDepartmentUseCase {
  constructor(private departmentRepo: IDepartmentRepository) {}

  async execute(clinicId: string, id: string, department: Partial<Department>): Promise<void> {
    return this.departmentRepo.update(id, clinicId, department);
  }
}
