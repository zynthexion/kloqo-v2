import { IActivityRepository } from '../domain/repositories';
import { ActivityLog } from '../../../packages/shared/src/index';

export class GetDoctorActivitiesUseCase {
    constructor(private activityRepo: IActivityRepository) {}

    async execute(doctorId: string, clinicId: string, limit?: number): Promise<ActivityLog[]> {
        if (!doctorId) throw new Error('Doctor ID is required');
        if (!clinicId) throw new Error('Clinic ID is required');

        return await this.activityRepo.findByDoctor(doctorId, clinicId, limit);
    }
}
