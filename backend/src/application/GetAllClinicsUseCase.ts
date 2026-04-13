import { IClinicRepository } from '../domain/repositories';
import { Clinic, PaginationParams, PaginatedResponse } from '../../../packages/shared/src/index';

export class GetAllClinicsUseCase {
  constructor(private clinicRepo: IClinicRepository) {}

  async execute(params?: PaginationParams): Promise<PaginatedResponse<Clinic> | Clinic[]> {
    return this.clinicRepo.findAll(params);
  }
}
