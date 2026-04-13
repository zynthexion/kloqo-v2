import { IClinicRepository } from '../domain/repositories';
import { Clinic } from '../../../packages/shared/src/index';

export class SaveClinicUseCase {
  constructor(private clinicRepo: IClinicRepository) {}

  async execute(clinic: Clinic): Promise<void> {
    return this.clinicRepo.save(clinic);
  }
}
