import { INotificationRepository } from '../domain/repositories';

export class ResetNotificationConfigsUseCase {
  constructor(private notificationRepo: INotificationRepository) {}

  async execute(clinicId: string): Promise<void> {
    await this.notificationRepo.resetConfigsToDefaults(clinicId);
  }
}
