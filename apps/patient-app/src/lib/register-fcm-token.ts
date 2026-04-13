/**
 * registerFCMToken — Client-side FCM Token Capture
 *
 * This is the ONLY Firebase interaction permitted on the frontend.
 * The `firebase/messaging` package is used purely as a browser API bridge
 * to obtain a device push token from the FCM infrastructure.
 *
 * The token is treated as opaque data — like a GPS coordinate.
 * We immediately hand it off to the central backend (POST /users/me/fcm-token)
 * and forget about it. The backend handles all notification dispatch.
 *
 * This function is called once after a successful login.
 *
 * Important: If the user denies notification permission or the browser
 * doesn't support notifications, we fail gracefully and silently.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

export async function registerFCMToken(authToken: string): Promise<void> {
  try {
    // Guard: Only in browser, only if VAPID key is configured
    if (typeof window === 'undefined' || !VAPID_KEY) return;

    // Guard: Browser must support notifications
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    // Request permission — do not throw, just bail if denied
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Notification permission denied. Skipping token registration.');
      return;
    }

    // Dynamically import to avoid SSR issues and keep bundle size small
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

    // Reuse existing app if already initialized
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const messaging = getMessaging(app);

    // Wait for service worker to be ready (required for getToken)
    const swRegistration = await navigator.serviceWorker.ready;

    const fcmToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!fcmToken) {
      console.warn('[FCM] Could not retrieve token. No push token registered.');
      return;
    }

    // Hand the token off to the backend — frontend's job is done here.
    await fetch(`${API_URL}/users/me/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ fcmToken }),
    });

    console.log('[FCM] Token registered with backend successfully.');
  } catch (err) {
    // Never throw — push notifications are non-critical
    console.warn('[FCM] Token registration failed (non-critical):', err);
  }
}
