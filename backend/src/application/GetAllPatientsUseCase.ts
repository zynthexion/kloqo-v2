import { IPatientRepository } from '../domain/repositories';
import { Patient, PaginationParams, PaginatedResponse } from '../../../packages/shared/src/index';

export class GetAllPatientsUseCase {
  constructor(private patientRepo: IPatientRepository) {}

  async execute(params?: PaginationParams): Promise<PaginatedResponse<Patient> | Patient[]> {
    return this.patientRepo.findAll(params);
  }
}
