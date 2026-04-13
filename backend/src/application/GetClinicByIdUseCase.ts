import { IClinicRepository } from '../domain/repositories';
import { Clinic } from '../../../packages/shared/src/index';

export class GetClinicByIdUseCase {
  constructor(private clinicRepo: IClinicRepository) {}

  async execute(id: string): Promise<Clinic | null> {
    return this.clinicRepo.findById(id);
  }
}
