/**
 * registerFCMToken — Nurse App Client-side FCM Token Capture
 * Same pattern as patient-app. See patient-app/src/lib/register-fcm-token.ts for full docs.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

export async function registerFCMToken(authToken: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || !VAPID_KEY) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const { getMessaging, getToken } = await import('firebase/messaging');
    const { initializeApp, getApps } = await import('firebase/app');

    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const messaging = getMessaging(app);
    const swRegistration = await navigator.serviceWorker.ready;

    const fcmToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!fcmToken) return;

    await fetch(`${API_URL}/users/me/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ fcmToken }),
    });

    console.log('[FCM] Nurse token registered with backend.');
  } catch (err) {
    console.warn('[FCM] Nurse token registration failed (non-critical):', err);
  }
}
