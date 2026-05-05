import { IAppointmentRepository } from '../domain/repositories';
import { getClinicNow } from '../domain/services/DateUtils';

export class PurgeStaleGhostsUseCase {
  constructor(private appointmentRepo: IAppointmentRepository) {}

  async execute(): Promise<{ purgedCount: number }> {
    const now = getClinicNow();
    // 48 hours ago
    const threshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    console.log(`[PurgeGhosts] Starting purge for ghosts created before ${threshold.toISOString()}`);

    // Fetch all ghosts across all clinics (Global Admin Query)
    // We'll use a simplified version: find all with bookedVia === 'BreakBlock'
    // Note: If the repo doesn't have a global search, we might need to add one.
    // However, I can add a method to IAppointmentRepository for this.

    const purgedCount = await this.appointmentRepo.purgeStaleGhosts(threshold);

    return { purgedCount };
  }
}
