import { IGlobalSettingsRepository, GlobalSettings } from '../../domain/repositories';
import { db } from './config';

export class FirebaseGlobalSettingsRepository implements IGlobalSettingsRepository {
  private docRef = db.collection('settings').doc('global');

  async getSettings(): Promise<GlobalSettings> {
    const doc = await this.docRef.get();
    if (!doc.exists) {
      // Default settings if not exists
      return {
        isWhatsAppEnabled: true,
        updatedAt: new Date()
      };
    }
    return doc.data() as GlobalSettings;
  }

  async updateSettings(data: Partial<GlobalSettings>): Promise<void> {
    await this.docRef.set({
      ...data,
      updatedAt: new Date()
    }, { merge: true });
  }
}
