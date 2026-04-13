import { INotificationRepository } from '../domain/repositories';

export class ResetNotificationConfigsUseCase {
  constructor(private notificationRepo: INotificationRepository) {}

  async execute(): Promise<void> {
    await this.notificationRepo.resetConfigsToDefaults();
  }
}
