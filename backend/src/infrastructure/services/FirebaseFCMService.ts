/**
 * FCMService — Infrastructure Service
 *
 * Strictly confined to the backend. No frontend app ever imports this.
 * Implements the IFCMService interface from the domain layer.
 *
 * FCM Token on the frontend is treated as opaque data (like a GPS coordinate).
 * The frontend POSTs it to /users/me/fcm-token. This service reads stored tokens
 * from Firestore and dispatches push notifications via firebase-admin.
 *
 * Architecture: infrastructure/ (I/O only, no business logic)
 */

import * as admin from 'firebase-admin';
import { IUserRepository, IPatientRepository } from '../../domain/repositories';

export interface FCMNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface IFCMService {
  sendToUser(userId: string, clinicId: string, payload: FCMNotificationPayload): Promise<boolean>;
  sendToMultipleUsers(userIds: string[], clinicId: string, payload: FCMNotificationPayload): Promise<{ successCount: number; failureCount: number }>;
  storeToken(userId: string, clinicId: string, fcmToken: string): Promise<void>;
  removeToken(userId: string, clinicId: string, fcmToken: string): Promise<void>;
}

export class FirebaseFCMService implements IFCMService {
  constructor(
    private userRepo: IUserRepository,
    private patientRepo: IPatientRepository
  ) {}

  /**
   * Send a push notification to a single user.
   * Looks up stored FCM tokens from the user record.
   */
  async sendToUser(userId: string, clinicId: string, payload: FCMNotificationPayload): Promise<boolean> {
    try {
      // 🛡️ SECURITY: Use 'SYSTEM' bypass because patients are global users 
      // and their record might not match the specific clinicId sending the alert.
      let user = await this.userRepo.findById(userId, 'SYSTEM');

      // 🔄 FALLBACK 1: If userId (patientId) is not the Auth UID, lookup by patientId field
      if (!user) {
        user = await this.userRepo.findByPatientId(userId, 'SYSTEM');
      }

      // 🔄 FALLBACK 2: Family/Relative Lookup
      // If we still have no user, it means userId is likely a Relative's Patient ID.
      // We lookup the Patient record to find the Primary's communicationPhone.
      if (!user) {
        const patient = await this.patientRepo.findById(userId, 'SYSTEM');
        if (patient && patient.communicationPhone) {
          // Find the User record associated with the Primary's phone
          user = await this.userRepo.findByPhone(patient.communicationPhone, 'SYSTEM');
        }
      }

      const rawTokens: string[] = (user as any)?.fcmTokens || [];
      const tokens = Array.from(new Set(rawTokens)).filter(Boolean);

      if (tokens.length === 0) {
        console.log(`[FCM] No tokens for user ${userId}. Skipping push.`);
        return false;
      }

      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: { 
            sound: 'default', 
            channelId: 'kloqo_appointments',
            vibrateTimingsMillis: [500, 200, 500, 200, 800, 200, 800] 
          },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1, 'interruption-level': 'critical' } },
        },
        webpush: {
          notification: {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge.png',
            vibrate: [500, 200, 500, 200, 800, 200, 800],
            requireInteraction: true,
            tag: payload.data?.type || 'kloqo-alert',
            renotify: true
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`[FCM] Sent to ${userId}: ${response.successCount} success, ${response.failureCount} failure`);

      // Prune stale tokens
      const staleTokens = response.responses
        .map((r, i) => (r.success ? null : tokens[i]))
        .filter(Boolean) as string[];

      for (const stale of staleTokens) {
        await this.removeToken(userId, clinicId, stale);
      }

      return response.successCount > 0;
    } catch (err: any) {
      console.error(`[FCM] sendToUser error for ${userId}:`, err);
      return false;
    }
  }

  /**
   * Fan-out to multiple users. Used for session-start notifications.
   */
  async sendToMultipleUsers(
    userIds: string[],
    clinicId: string,
    payload: FCMNotificationPayload
  ): Promise<{ successCount: number; failureCount: number }> {
    let successCount = 0;
    let failureCount = 0;

    await Promise.allSettled(
      userIds.map(async (uid) => {
        const ok = await this.sendToUser(uid, clinicId, payload);
        if (ok) successCount++; else failureCount++;
      })
    );

    return { successCount, failureCount };
  }

  /**
   * Store a new FCM token for a user (called when token is received from frontend).
   * Merges into the user's fcmTokens array — deduplicates in-place.
   */
  async storeToken(userId: string, clinicId: string, fcmToken: string): Promise<void> {
    // 🛡️ SECURITY: Use 'SYSTEM' bypass to ensure we find the user regardless of their primary clinicId.
    // Patients often move between clinics, but their push token is global to their account.
    const user = await this.userRepo.findById(userId, 'SYSTEM');
    if (!user) throw new Error(`User ${userId} not found`);

    const existing: string[] = (user as any).fcmTokens || [];
    if (!existing.includes(fcmToken)) {
      const updated = [...existing, fcmToken].slice(-5); // keep max 5 tokens per user
      await this.userRepo.update(userId, 'SYSTEM', { fcmTokens: updated } as any);
      console.log(`[FCM] Stored token for user ${userId}. Total tokens: ${updated.length}`);
    }
  }

  /**
   * Remove a stale or revoked FCM token.
   */
  async removeToken(userId: string, clinicId: string, fcmToken: string): Promise<void> {
    const user = await this.userRepo.findById(userId, 'SYSTEM');
    if (!user) return;

    const existing: string[] = (user as any).fcmTokens || [];
    const updated = existing.filter((t) => t !== fcmToken);
    await this.userRepo.update(userId, 'SYSTEM', { fcmTokens: updated } as any);
    console.log(`[FCM] Pruned stale token for user ${userId}`);
  }
}
