import { Request, Response } from 'express';
import { GetGlobalSettingsUseCase, UpdateGlobalSettingsUseCase } from '../application/GlobalSettingsUseCases';

export class SettingsController {
  constructor(
    private getGlobalSettingsUseCase: GetGlobalSettingsUseCase,
    private updateGlobalSettingsUseCase: UpdateGlobalSettingsUseCase
  ) {}

  async getGlobalSettings(req: Request, res: Response) {
    try {
      const settings = await this.getGlobalSettingsUseCase.execute();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateGlobalSettings(req: Request, res: Response) {
    try {
      await this.updateGlobalSettingsUseCase.execute(req.body);
      res.json({ message: 'Global settings updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
