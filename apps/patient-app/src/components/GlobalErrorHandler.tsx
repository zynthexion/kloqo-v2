'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { logError } from '@/lib/error-logger';
import { usePathname } from 'next/navigation';

/**
 * Global Error Handler - Catches unhandled errors and promise rejections
 * This component should be added to the root layout.
 * It uses the modular logError utility which communicates with the V2 Backend.
 */
export function GlobalErrorHandler() {
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Handle unhandled errors
    const handleError = (event: ErrorEvent) => {
      const error = event.error || new Error(event.message || 'Unknown error');

      logError(error, {
        userId: (user as any)?.id || (user as any)?.dbUserId,
        userRole: user?.role,
        page: pathname,
        action: 'unhandled_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }).catch(() => {
        // Silently fail - error logging shouldn't break the app
      });
    };

    // Handle unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason || 'Unhandled promise rejection'));

      logError(error, {
        userId: (user as any)?.id || (user as any)?.dbUserId,
        userRole: user?.role,
        page: pathname,
        action: 'unhandled_promise_rejection',
        reason: String(event.reason),
      }).catch(() => {
        // Silently fail
      });
    };

    // Attach listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [user, pathname]);

  return null; // This component doesn't render anything
}
