import { BatchNotificationService } from '../domain/services/BatchNotificationService';

export class ProcessBatchNotificationsUseCase {
  constructor(private batchNotificationService: BatchNotificationService) {}

  async execute(params: {
    clinicId?: string;
    window: 'morning' | 'evening' | 'expiry' | 'global-7am' | 'global-5pm';
  }): Promise<void> {
    const { clinicId, window } = params;

    if (window === 'global-7am') {
      await this.batchNotificationService.syncTrialExpirations();
      await this.batchNotificationService.processGlobalBatch('7AM');
    } else if (window === 'global-5pm') {
      await this.batchNotificationService.processGlobalBatch('5PM');
    } else if (window === 'morning' && clinicId) {
      await this.batchNotificationService.processMorningReminders(clinicId);
    } else if (window === 'evening' && clinicId) {
      await this.batchNotificationService.processEveningReminders(clinicId);
    } else if (window === 'expiry' && clinicId) {
      await this.batchNotificationService.checkFollowUpExpiries(clinicId);
    }
  }
}
