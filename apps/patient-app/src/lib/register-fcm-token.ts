import { getFCMToken } from './firebase-messaging';
import { apiRequest } from './api-client';

/**
 * registerFCMToken — Client-side FCM Token Capture & Sync
 */
export async function registerFCMToken(authToken: string, userId?: string): Promise<void> {
  try {
    if (typeof window === 'undefined') return;

    // 1. Get the token using our robust helper
    const fcmToken = await getFCMToken();
    if (!fcmToken) return;

    // 2. Resolve userId if not provided
    let finalUserId = userId;
    if (!finalUserId) {
        const profile = await apiRequest('/auth/me');
        finalUserId = profile?.user?.id;
    }

    if (!finalUserId) {
        console.error('[FCM] Could not resolve userId for token registration');
        return;
    }

    // 3. Sync to backend using the standard notifications route
    console.log(`[FCM] Syncing token for user ${finalUserId}...`);
    await apiRequest(`/users/${finalUserId}/notifications`, {
      method: 'PATCH',
      body: JSON.stringify({ 
        fcmToken,
        notificationsEnabled: true,
        notificationPermissionGranted: true,
        fcmTokenUpdatedAt: new Date().toISOString()
      }),
    });

    console.log('[FCM] Token and permissions synced successfully.');
  } catch (err) {
    console.warn('[FCM] Token registration failed (non-critical):', err);
  }
}
