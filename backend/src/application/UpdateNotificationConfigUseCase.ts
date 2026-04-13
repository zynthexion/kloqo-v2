import { INotificationRepository } from '../domain/repositories';
import { NotificationConfig } from '../../../packages/shared/src/index';

export interface UpdateNotificationConfigDTO {
  id: string;
  data: Partial<NotificationConfig>;
}

export class UpdateNotificationConfigUseCase {
  constructor(private notificationRepo: INotificationRepository) {}

  async execute(dto: UpdateNotificationConfigDTO): Promise<void> {
    await this.notificationRepo.updateConfig(dto.id, dto.data);
  }
}
