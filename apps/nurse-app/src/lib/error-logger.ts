/**
 * Error Logger - Production Error Tracking for V2
 * Logs errors via the backend API
 */

import { ErrorSeverity, ErrorContext, ErrorLog } from '@kloqo/shared';
import { apiRequest } from './api-client';

let errorQueue: any[] = [];
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    flushErrorQueue();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
  });
}

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = sessionStorage.getItem('error_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('error_session_id', sessionId);
  }
  return sessionId;
}

function getDeviceInfo(): ErrorContext['deviceInfo'] {
  if (typeof window === 'undefined') {
    return {
      userAgent: 'server',
      platform: 'server',
      language: 'en',
    };
  }

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    language: navigator.language || 'en',
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
  };
}

function getCurrentPage(): string {
  if (typeof window === 'undefined') return 'server';
  return window.location.pathname;
}

function determineSeverity(error: Error): ErrorSeverity {
  if (
    error.message.includes('network') ||
    error.message.includes('auth') ||
    error.message.includes('permission') ||
    error.message.includes('payment') ||
    error.message.includes('Failed to fetch')
  ) {
    return 'critical';
  }

  if (
    error.message.includes('undefined') ||
    error.message.includes('null') ||
    error.message.includes('Cannot read') ||
    error.message.includes('validation')
  ) {
    return 'high';
  }

  if (
    error.message.includes('render') ||
    error.message.includes('component') ||
    error.message.includes('hook')
  ) {
    return 'medium';
  }

  return 'low';
}

function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefined);
  
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = removeUndefined(obj[key]);
    }
  }
  return cleaned;
}

export async function logError(
  error: Error | string,
  _ignored?: any, // Maintain signature parity
  context: Partial<ErrorContext> = {}
): Promise<void> {
  try {
    const errorObj = typeof error === 'string' 
      ? new Error(error) 
      : error;

    const errorData: any = {
      name: errorObj.name || 'Error',
      message: errorObj.message || String(error),
    };
    
    if (errorObj.stack) {
      errorData.stack = errorObj.stack;
    }

    const payload = {
      error: errorData,
      severity: determineSeverity(errorObj),
      context: {
        ...removeUndefined({
          ...context,
          deviceInfo: getDeviceInfo(),
          page: context.page || getCurrentPage(),
          appVersion: '2.0.0',
        }),
      },
      appName: 'nurse-app' as const,
      sessionId: getSessionId(),
    };

    if (isOnline) {
      await apiRequest('/log-error', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } else {
      errorQueue.push(payload);
    }
  } catch (loggingError) {
    console.error('Failed to log error:', loggingError);
  }
}

async function flushErrorQueue(): Promise<void> {
  if (!isOnline || errorQueue.length === 0) return;

  const errorsToFlush = [...errorQueue];
  errorQueue = [];

  for (const payload of errorsToFlush) {
    try {
      await apiRequest('/log-error', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (error) {
      errorQueue.push(payload);
    }
  }
}

export { flushErrorQueue };
