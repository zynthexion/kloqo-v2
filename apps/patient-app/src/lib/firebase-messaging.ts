'use client';

/**
 * Firebase Messaging (V2 - Firebase Free Replacement)
 * The patient-app is now 100% Firebase-free in the frontend.
 * Push notifications via FCM are disabled.
 */

export const setupForegroundMessageListener = () => null;
export const setupTokenRefreshListener = () => () => {};
export const registerServiceWorker = async () => null;
export const getFCMToken = async () => null;
export const isNotificationEnabled = () => false;
export const useFCMToken = () => ({ token: null, permission: 'denied' });
export const requestNotificationPermission = async () => 'denied';
