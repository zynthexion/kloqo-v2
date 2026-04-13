/**
 * Error Logger - Production Error Tracking
 * Logs errors to Backend API for monitoring and debugging
 */

import { apiRequest } from './api-client';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  userId?: string;
  userRole?: string;
  page?: string;
  action?: string;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    language: string;
    screenWidth?: number;
    screenHeight?: number;
  };
  appVersion?: string;
  [key: string]: any;
}

export interface ErrorLog {
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  severity: ErrorSeverity;
  context: ErrorContext;
  timestamp?: string;
  appName: 'patient-app' | 'nurse-app' | 'clinic-admin';
  sessionId?: string;
}

// Queue errors if backend is not available (offline)
let errorQueue: ErrorLog[] = [];
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

/**
 * Generate a session ID for tracking user sessions
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = sessionStorage.getItem('error_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('error_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Get device/browser information
 */
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

/**
 * Get current page/route
 */
function getCurrentPage(): string {
  if (typeof window === 'undefined') return 'server';
  return window.location.pathname;
}

/**
 * Determine error severity based on error type
 */
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

/**
 * Helper function to remove undefined values from objects
 */
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

/**
 * Log error to Backend
 */
export async function logError(
  error: Error | string,
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
    if ((errorObj as any).code) {
      errorData.code = (errorObj as any).code;
    }

    const errorLog: ErrorLog = {
      error: errorData,
      severity: determineSeverity(errorObj),
      context: removeUndefined({
        ...context,
        deviceInfo: getDeviceInfo(),
        page: context.page || getCurrentPage(),
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      }),
      appName: 'patient-app',
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
    };

    const cleanedErrorLog = removeUndefined(errorLog);

    if (isOnline) {
      try {
        await apiRequest('/log-error', {
          method: 'POST',
          body: JSON.stringify(cleanedErrorLog),
        });
      } catch (backendError) {
        console.error('Failed to log error to backend:', backendError);
        errorQueue.push(cleanedErrorLog);
      }
    } else {
      errorQueue.push(cleanedErrorLog);
    }
  } catch (loggingError) {
    console.error('Failed to log error:', loggingError);
    console.error('Original error:', error);
  }
}

/**
 * Flush queued errors when back online
 */
export async function flushErrorQueue(): Promise<void> {
  if (!isOnline || errorQueue.length === 0) return;

  const errorsToFlush = [...errorQueue];
  errorQueue = [];

  for (const errorLog of errorsToFlush) {
    try {
      await apiRequest('/log-error', {
        method: 'POST',
        body: JSON.stringify(errorLog),
      });
    } catch (error) {
      errorQueue.push(errorLog);
    }
  }
}

/**
 * Log custom events (traffic analytics)
 */
export async function logEvent(
  eventName: string,
  data: Record<string, any> = {}
): Promise<void> {
  try {
    const eventLog = {
      eventName,
      data,
      timestamp: new Date().toISOString(),
      appName: 'patient-app' as const,
      sessionId: getSessionId(),
      page: getCurrentPage(),
      deviceInfo: getDeviceInfo(),
    };

    if (isOnline) {
      await apiRequest('/analytics/traffic', {
        method: 'POST',
        body: JSON.stringify(eventLog),
      });
    }
  } catch (error) {
    console.error('Failed to log event:', error);
  }
}
