import { Request, Response } from 'express';
import { GetNotificationConfigsUseCase } from '../application/GetNotificationConfigsUseCase';
import { UpdateNotificationConfigUseCase } from '../application/UpdateNotificationConfigUseCase';
import { ResetNotificationConfigsUseCase } from '../application/ResetNotificationConfigsUseCase';
import { ProcessBatchNotificationsUseCase } from '../application/ProcessBatchNotificationsUseCase';
import { SendBookingLinkUseCase } from '../application/SendBookingLinkUseCase';

export class NotificationController {
  constructor(
    private getNotificationConfigsUseCase: GetNotificationConfigsUseCase,
    private updateNotificationConfigUseCase: UpdateNotificationConfigUseCase,
    private resetNotificationConfigsUseCase: ResetNotificationConfigsUseCase,
    private processBatchNotificationsUseCase: ProcessBatchNotificationsUseCase,
    private sendBookingLinkUseCase: SendBookingLinkUseCase
  ) {}

  async sendBookingLink(req: Request, res: Response) {
    try {
      const { phone, clinicId, patientName } = req.body;
      if (!phone || !clinicId) {
        return res.status(400).json({ error: 'phone and clinicId are required' });
      }
      await this.sendBookingLinkUseCase.execute({ phone, clinicId, patientName });
      res.json({ message: 'Booking link sent successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async processBatchNotifications(req: Request, res: Response) {
    try {
      const { clinicId, window } = req.body;
      if (!clinicId || !window) {
        return res.status(400).json({ error: 'clinicId and window are required' });
      }
      await this.processBatchNotificationsUseCase.execute({ clinicId, window });
      res.json({ message: `Batch notifications for ${window} processed successfully` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getConfigs(req: Request, res: Response) {
    try {
      const data = await this.getNotificationConfigsUseCase.execute();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateConfig(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;
      await this.updateNotificationConfigUseCase.execute({ id, data });
      res.json({ message: 'Notification configuration updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async resetConfigs(req: Request, res: Response) {
    try {
      await this.resetNotificationConfigsUseCase.execute();
      res.json({ message: 'Notification configurations reset to defaults' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
