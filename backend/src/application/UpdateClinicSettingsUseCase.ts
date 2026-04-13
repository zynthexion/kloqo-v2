import { IClinicRepository } from '../domain/repositories';

export interface UpdateClinicSettingsRequest {
    clinicId: string;
    operatingHours?: any[];
    tokenDistribution?: 'classic' | 'advanced';
    walkInTokenAllotment?: number;
    showEstimatedWaitTime?: boolean;
    genderPreference?: 'Men' | 'Women' | 'General';
}

export class UpdateClinicSettingsUseCase {
    constructor(private clinicRepo: IClinicRepository) {}

    async execute(request: UpdateClinicSettingsRequest): Promise<void> {
        const { clinicId, ...settings } = request;

        const clinic = await this.clinicRepo.findById(clinicId);
        if (!clinic) throw new Error('Clinic not found');

        await this.clinicRepo.update(clinicId, {
            ...settings,
            updatedAt: new Date()
        });
    }
}
