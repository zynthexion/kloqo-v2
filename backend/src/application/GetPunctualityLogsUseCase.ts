import { IPunctualityRepository } from '../domain/repositories';
import { PunctualityLog } from '../../../packages/shared/src/index';

export class GetPunctualityLogsUseCase {
  constructor(private punctualityRepo: IPunctualityRepository) {}

  async execute(doctorId?: string): Promise<PunctualityLog[]> {
    if (doctorId) {
      return this.punctualityRepo.findByDoctorId(doctorId);
    }
    return this.punctualityRepo.findAll();
  }
}
