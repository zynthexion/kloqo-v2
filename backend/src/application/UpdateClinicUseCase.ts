import { IClinicRepository } from '../domain/repositories';
import { Clinic } from '../../../packages/shared/src/index';

export class UpdateClinicUseCase {
  constructor(private clinicRepo: IClinicRepository) {}

  async execute(id: string, data: Partial<Clinic>): Promise<void> {
    return this.clinicRepo.update(id, data);
  }
}
