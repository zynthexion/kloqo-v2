'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only on client side
const app = typeof window !== 'undefined' && (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]);
const messaging = typeof window !== 'undefined' ? getMessaging(app as any) : null;

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined') return 'denied';
  console.log('[FCM] Requesting permission...');
  try {
    const permission = await Notification.requestPermission();
    console.log('[FCM] Permission status:', permission);
    return permission === 'granted';
  } catch (error) {
    console.error('[FCM] Permission request error:', error);
    return false;
  }
};

export const getFCMToken = async () => {
  if (typeof window === 'undefined' || !messaging) {
    console.log('[FCM] Messaging not initialized or not in window');
    return null;
  }
  console.log('[FCM] Getting token...');
  try {
    let swRegistration = null;
    
    // 1. Try to register it explicitly to avoid hanging
    try {
      console.log('[FCM] Registering firebase-messaging-sw.js...');
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope'
      });
      console.log('[FCM] Registration successful');
    } catch (regError) {
      console.warn('[FCM] Manual registration failed, falling back to ready...', regError);
      swRegistration = await navigator.serviceWorker.ready;
    }

    console.log('[FCM] Using Service Worker:', swRegistration?.active?.scriptURL || swRegistration?.installing?.scriptURL || 'Unknown');
    
    // 2. 🛡️ WAIT for the service worker to be ACTIVE
    // If it's still installing or waiting, getToken will fail.
    if (!swRegistration.active) {
      console.log('[FCM] Service worker not yet active, waiting...');
      await new Promise<void>((resolve) => {
        const worker = swRegistration.installing || swRegistration.waiting;
        if (!worker) return resolve();
        worker.addEventListener('statechange', (e: any) => {
          if (e.target.state === 'activated') {
            console.log('[FCM] Service worker activated!');
            resolve();
          }
        });
      });
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
      serviceWorkerRegistration: swRegistration
    });
    
    console.log('[FCM] Token response received:', token ? 'Success' : 'Empty');
    return token;
  } catch (error) {
    console.error('[FCM] Get token error:', error);
    return null;
  }
};

export const setupForegroundMessageListener = () => {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground message received:', payload);
    // You could trigger a toast or a haptic pulse here
  });
};

export const isNotificationEnabled = () => {
  if (typeof window === 'undefined') return false;
  return Notification.permission === 'granted';
};
