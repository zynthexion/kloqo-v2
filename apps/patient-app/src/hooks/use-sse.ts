'use client';

/**
 * useSSE — Shared Real-time Hook (Patient App)
 *
 * Replaces all setInterval polling for clinic state changes.
 * Uses the browser-native EventSource API to consume the backend's
 * Server-Sent Events stream at GET /events/clinic/:clinicId.
 *
 * Usage:
 *   useSSE({ clinicId, onEvent })
 *
 * The hook connects automatically when clinicId is defined and
 * disconnects cleanly on unmount. A keep-alive reconnect is baked in.
 *
 * Architecture: Zero Firebase. Zero polling. Pure HTTP/SSE.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type SSEEventType =
  | 'appointment_status_changed'
  | 'doctor_status_changed'
  | 'queue_updated'
  | 'walk_in_created'
  | 'token_called'
  | 'session_started'
  | 'session_ended'
  | 'break_scheduled'
  | 'break_cancelled'
  | 'appointment_reslotted'
  | 'queue_reoptimized';

export interface SSEPayload {
  type: SSEEventType;
  clinicId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

interface UseSSEOptions {
  /** The clinic to subscribe to. Hook is a no-op when undefined. */
  clinicId: string | null | undefined;
  /** Called every time any SSE event arrives for this clinic. */
  onEvent: (event: SSEPayload) => void;
  /** Whether to auto-reconnect on error. Default: true */
  autoReconnect?: boolean;
}

export interface UseSSEResult {
  /** Current EventSource.readyState: 0=CONNECTING, 1=OPEN, 2=CLOSED */
  readyState: number;
}

export function useSSE({ clinicId, onEvent, autoReconnect = true }: UseSSEOptions): UseSSEResult {
  const esRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [readyState, setReadyState] = useState<number>(EventSource.CONNECTING);

  // Keep the callback ref up-to-date without triggering re-connects
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  const connect = useCallback(() => {
    if (!clinicId) return;

    // Clean up any existing connection before creating a new one
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    // 🔒 SSE STABILITY FIX: Fetch fresh token on every connection attempt
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const url = `${API_URL}/events/clinic/${clinicId}?token=${token}`;
    
    console.log(`[useSSE] Connecting to ${url}...`);
    const es = new EventSource(url);
    esRef.current = es;

    // ── Event type listeners ────────────────────────────────────────────────
    const eventTypes: SSEEventType[] = [
      'appointment_status_changed',
      'doctor_status_changed',
      'queue_updated',
      'walk_in_created',
      'token_called',
      'session_started',
      'session_ended',
      'break_scheduled',
      'break_cancelled',
      'queue_reoptimized',
    ];

    eventTypes.forEach((type) => {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as SSEPayload;
          onEventRef.current(data);
        } catch {
          console.warn('[useSSE] Failed to parse event data:', e.data);
        }
      });
    });

    es.onopen = () => setReadyState(EventSource.OPEN);

    es.onerror = (err) => {
      console.error(`[useSSE] Connection lost for clinic ${clinicId}.`, err);
      setReadyState(EventSource.CLOSED);
      es.close();
      esRef.current = null;

      if (autoReconnect) {
        // Retry with a fresh token after 5 seconds (SRE recommendation)
        console.log('[useSSE] Attempting custom reconnect in 5s...');
        reconnectTimerRef.current = setTimeout(connect, 5000);
      }
    };
  }, [clinicId, autoReconnect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);

  return { readyState };
}
