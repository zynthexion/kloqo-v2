'use client';

import { useEffect } from 'react';
import { logError } from '@/lib/error-logger';
import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';

export function GlobalErrorHandler() {
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleError = (event: ErrorEvent) => {
      const error = event.error || new Error(event.message || 'Unknown error');
      
      logError(error, null, {
        userId: user?.id,
        userRole: user?.role || 'nurse',
        page: pathname,
        action: 'unhandled_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }).catch(() => {
        // Silently fail
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason || 'Unhandled promise rejection'));

      logError(error, null, {
        userId: user?.id,
        userRole: user?.role || 'nurse',
        page: pathname,
        action: 'unhandled_promise_rejection',
        reason: String(event.reason),
      }).catch(() => {
        // Silently fail
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [user, pathname]);

  return null;
}
