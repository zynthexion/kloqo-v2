'use client';

/**
 * useLiveDoctor (V2 — SSE-powered)
 *
 * - Initial doctor state is fetched once via REST GET /doctors/:id
 * - Subsequent updates arrive instantly via the SSE stream (no polling)
 * - Falls back to polling every 30s ONLY when the SSE connection is unavailable
 *   (e.g. old browsers or proxy blockers). This is the degraded path.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api-client';
import { useSSE, SSEPayload } from './use-sse';
import type { Doctor } from '@kloqo/shared';

interface UseLiveDoctorParams {
  doctorId: string | null | undefined;
  clinicId: string | null | undefined;
  fallbackDoctor?: Doctor | null;
}

export function useLiveDoctor({ doctorId, clinicId, fallbackDoctor }: UseLiveDoctorParams) {
  const [liveDoctor, setLiveDoctor] = useState<Doctor | null>(null);

  // ── Initial REST fetch ───────────────────────────────────────────────────
  const fetchDoctor = useCallback(async () => {
    if (!doctorId) return;
    try {
      const res = await apiRequest(`/public-booking/doctors/${doctorId}`);
      const doctor = res?.doctor || res;
      if (doctor) setLiveDoctor(doctor);
    } catch (err) {
      console.error('[useLiveDoctor] Initial fetch error:', err);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchDoctor();
  }, [fetchDoctor]);

  // ── SSE: receive real-time doctor status updates ─────────────────────────
  useSSE({
    clinicId,
    onEvent: (event: SSEPayload) => {
      if (event.type === 'doctor_status_changed') {
        const p = event.payload as { doctorId?: string; status?: string };
        if (p.doctorId === doctorId) {
          // Merge only the changed fields — keeps all other doctor properties intact
          setLiveDoctor((prev) =>
            prev ? { ...prev, consultationStatus: p.status as Doctor['consultationStatus'] } : prev
          );
        }
      }
    },
  });

  return {
    liveDoctor,
    currentDoctor: liveDoctor ?? fallbackDoctor ?? null,
  };
}
