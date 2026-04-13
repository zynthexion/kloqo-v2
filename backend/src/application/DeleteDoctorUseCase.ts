import { IDoctorRepository, IClinicRepository } from '../domain/repositories';

export class DeleteDoctorUseCase {
  constructor(
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository
  ) {}

  async execute(id: string, soft: boolean = true): Promise<void> {
    // 1. Find the doctor first to get the clinicId for the counter decrement.
    const doctor = await this.doctorRepo.findById(id);
    if (!doctor) {
      throw new Error(`Doctor with ID ${id} not found.`);
    }

    // 2. Delete (or soft-delete) the doctor document.
    await this.doctorRepo.delete(id, soft);

    // 3. Atomically decrement the clinic's doctor count.
    // This runs after a confirmed delete to keep the counter in sync.
    await this.clinicRepo.incrementDoctorCount(doctor.clinicId, -1);
  }
}
