import { IClinicRepository } from '../domain/repositories';

export interface UpdateWhatsappConfigRequest {
    clinicId: string;
    shortCode?: string;
}

export class UpdateWhatsappConfigUseCase {
    constructor(private clinicRepo: IClinicRepository) {}

    async execute(request: UpdateWhatsappConfigRequest): Promise<void> {
        const { clinicId, shortCode } = request;

        const clinic = await this.clinicRepo.findById(clinicId);
        if (!clinic) throw new Error('Clinic not found');

        await this.clinicRepo.update(clinicId, {
            shortCode,
            updatedAt: new Date()
        });
    }
}
