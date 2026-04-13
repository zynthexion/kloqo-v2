import { INotificationRepository } from '../../domain/repositories';
import { NotificationConfig, NOTIFICATION_TYPES, NOTIFICATION_METADATA } from '../../../../packages/shared/src/index';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './config';

export class FirebaseNotificationRepository implements INotificationRepository {
  private collectionPath = 'system-config/notifications/templates';

  constructor() {}

  async findAllConfigs(): Promise<NotificationConfig[]> {
    const snapshot = await db.collection(this.collectionPath).get();
    const configs: Record<string, NotificationConfig> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      configs[doc.id] = {
        id: doc.id,
        ...data,
        whatsappEnabled: data.whatsappEnabled ?? data.enabled ?? true,
        pwaEnabled: data.pwaEnabled ?? true,
      } as NotificationConfig;
    });

    // Merge with metadata to ensure all types are present
    Object.entries(NOTIFICATION_TYPES).forEach(([key, id]) => {
      const notificationId = id as string;
      const meta = NOTIFICATION_METADATA[notificationId as keyof typeof NOTIFICATION_METADATA];

      if (!configs[notificationId]) {
        configs[notificationId] = {
          id: notificationId,
          name: meta.name,
          description: meta.description,
          category: meta.category,
          channels: meta.channels,
          whatsappEnabled: true,
          pwaEnabled: true,
          updatedAt: null,
        };
      } else {
        configs[notificationId].name = meta.name;
        configs[notificationId].description = meta.description;
        configs[notificationId].category = meta.category;
        configs[notificationId].channels = meta.channels;
      }
    });

    return Object.values(configs);
  }

  async updateConfig(id: string, data: Partial<NotificationConfig>): Promise<void> {
    const docRef = db.collection(this.collectionPath).doc(id);
    await docRef.set({
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  async resetConfigsToDefaults(): Promise<void> {
    const batch = db.batch();

    Object.entries(NOTIFICATION_TYPES).forEach(([key, id]) => {
      const notificationId = id as string;
      const meta = NOTIFICATION_METADATA[notificationId as keyof typeof NOTIFICATION_METADATA];
      const docRef = db.collection(this.collectionPath).doc(notificationId);
      
      batch.set(docRef, {
        id: notificationId,
        name: meta.name,
        description: meta.description,
        category: meta.category,
        channels: meta.channels,
        whatsappEnabled: true,
        pwaEnabled: true,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'system'
      });
    });

    await batch.commit();
  }
}
