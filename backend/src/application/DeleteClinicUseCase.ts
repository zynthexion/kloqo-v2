import { IClinicRepository } from '../domain/repositories';

export class DeleteClinicUseCase {
  constructor(private clinicRepo: IClinicRepository) {}

  async execute(id: string, soft: boolean = true): Promise<void> {
    return this.clinicRepo.delete(id, soft);
  }
}
