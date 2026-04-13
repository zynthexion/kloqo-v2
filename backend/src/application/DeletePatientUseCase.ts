import { IPatientRepository } from '../domain/repositories';

export class DeletePatientUseCase {
  constructor(private patientRepo: IPatientRepository) {}

  async execute(id: string, soft: boolean = true): Promise<void> {
    return this.patientRepo.delete(id, soft);
  }
}
