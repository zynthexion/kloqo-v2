import { IDepartmentRepository } from '../domain/repositories';
import { Department } from '../../../packages/shared/src/index';

export class SaveDepartmentUseCase {
  constructor(private departmentRepo: IDepartmentRepository) {}

  async execute(clinicId: string, department: Department): Promise<void> {
    return this.departmentRepo.save(department, clinicId);
  }
}
