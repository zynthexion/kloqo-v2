import { INotificationRepository } from '../domain/repositories';
import { NotificationConfig } from '../../../packages/shared/src/index';

export class GetNotificationConfigsUseCase {
  constructor(private notificationRepo: INotificationRepository) {}

  async execute(): Promise<NotificationConfig[]> {
    return this.notificationRepo.findAllConfigs();
  }
}
