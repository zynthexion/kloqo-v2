import { IGlobalSettingsRepository, GlobalSettings } from '../domain/repositories';

export class GetGlobalSettingsUseCase {
  constructor(private globalSettingsRepo: IGlobalSettingsRepository) {}

  async execute(): Promise<GlobalSettings> {
    const settings = await this.globalSettingsRepo.getSettings();
    if (!settings) {
      return { isWhatsAppEnabled: true, updatedAt: new Date() };
    }
    return settings;
  }
}

export class UpdateGlobalSettingsUseCase {
  constructor(private globalSettingsRepo: IGlobalSettingsRepository) {}

  async execute(data: Partial<GlobalSettings>): Promise<void> {
    await this.globalSettingsRepo.updateSettings(data);
  }
}
