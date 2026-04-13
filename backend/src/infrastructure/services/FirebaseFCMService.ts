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
import { IUserRepository } from '../../domain/repositories';

export interface FCMNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface IFCMService {
  sendToUser(userId: string, payload: FCMNotificationPayload): Promise<boolean>;
  sendToMultipleUsers(userIds: string[], payload: FCMNotificationPayload): Promise<{ successCount: number; failureCount: number }>;
  storeToken(userId: string, fcmToken: string): Promise<void>;
  removeToken(userId: string, fcmToken: string): Promise<void>;
}

export class FirebaseFCMService implements IFCMService {
  constructor(private userRepo: IUserRepository) {}

  /**
   * Send a push notification to a single user.
   * Looks up stored FCM tokens from the user record.
   */
  async sendToUser(userId: string, payload: FCMNotificationPayload): Promise<boolean> {
    try {
      const user = await this.userRepo.findById(userId);
      const tokens: string[] = (user as any)?.fcmTokens || [];

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
          notification: { sound: 'default', channelId: 'kloqo_appointments' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
        webpush: {
          notification: {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge.png',
            requireInteraction: true,
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
        await this.removeToken(userId, stale);
      }

      return response.successCount > 0;
    } catch (err) {
      console.error(`[FCM] sendToUser error for ${userId}:`, err);
      return false;
    }
  }

  /**
   * Fan-out to multiple users. Used for session-start notifications.
   */
  async sendToMultipleUsers(
    userIds: string[],
    payload: FCMNotificationPayload
  ): Promise<{ successCount: number; failureCount: number }> {
    let successCount = 0;
    let failureCount = 0;

    await Promise.allSettled(
      userIds.map(async (uid) => {
        const ok = await this.sendToUser(uid, payload);
        if (ok) successCount++; else failureCount++;
      })
    );

    return { successCount, failureCount };
  }

  /**
   * Store a new FCM token for a user (called when token is received from frontend).
   * Merges into the user's fcmTokens array — deduplicates in-place.
   */
  async storeToken(userId: string, fcmToken: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    const existing: string[] = (user as any).fcmTokens || [];
    if (!existing.includes(fcmToken)) {
      const updated = [...existing, fcmToken].slice(-5); // keep max 5 tokens per user
      await this.userRepo.update(userId, { fcmTokens: updated } as any);
      console.log(`[FCM] Stored token for user ${userId}. Total tokens: ${updated.length}`);
    }
  }

  /**
   * Remove a stale or revoked FCM token.
   */
  async removeToken(userId: string, fcmToken: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) return;

    const existing: string[] = (user as any).fcmTokens || [];
    const updated = existing.filter((t) => t !== fcmToken);
    await this.userRepo.update(userId, { fcmTokens: updated } as any);
    console.log(`[FCM] Pruned stale token for user ${userId}`);
  }
}
