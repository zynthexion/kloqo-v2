'use client';

import { useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api-client';
import { format } from 'date-fns';
import { useSSE } from './use-sse';

/**
 * useClinicSync
 * Global background sync for clinic/appointment status.
 * Replaces legacy redundant polling (60s / 120s) with SSE-triggered updates.
 */
export function useClinicSync() {
  const { currentUser } = useAuth();

  const sync = useCallback(async () => {
    if (!currentUser?.clinicId) return;
    try {
      await apiRequest('/clinic/sync-status', {
        method: 'POST',
        body: JSON.stringify({
          clinicId: currentUser.clinicId,
          date: format(new Date(), 'yyyy-MM-dd')
        })
      });
    } catch (err) {
      // Fail silently (non-critical background sync)
      console.warn('[ClinicSync] Global sync failed:', err);
    }
  }, [currentUser?.clinicId]);

  // 1. Initial sync on mount
  useEffect(() => {
    sync();
  }, [sync]);

  // 2. Real-time sync on major events (re-evaluates doctor status)
  useSSE({
    clinicId: currentUser?.clinicId,
    onEvent: useCallback((event) => {
      if (['appointment_status_changed', 'token_called', 'session_ended', 'session_started'].includes(event.type)) {
        sync();
      }
    }, [sync])
  });

  // 3. Fallback: Once every 10 minutes (for the passage of time)
  useEffect(() => {
    const id = setInterval(sync, 600000); 
    return () => clearInterval(id);
  }, [sync]);
}
