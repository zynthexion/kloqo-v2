/**
 * SSEController — Interfaces Layer
 *
 * Thin HTTP adapter. No business logic here.
 * Manages the Express SSE stream and delegates all event-routing to SSEService.
 *
 * Endpoints:
 *   GET /events/clinic/:clinicId  — public stream (unauthenticated for now; clinicId is not secret)
 */

import { Request, Response } from 'express';
import { sseService, SSEEvent } from '../domain/services/SSEService';
import { randomUUID } from 'crypto';

export class SSEController {
  /**
   * Establishes a Server-Sent Events stream for a given clinic.
   * The client (any frontend app) connects once and receives real-time events.
   *
   * Usage on frontend:
   *   const source = new EventSource(`${API_URL}/events/clinic/${clinicId}`);
   *   source.addEventListener('appointment_status_changed', handler);
   */
  handleClinicStream(req: Request, res: Response): void {
    const { clinicId } = req.params;

    if (!clinicId) {
      res.status(400).json({ error: 'clinicId is required' });
      return;
    }

    // ── SSE Headers ──────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Important for nginx proxies
    res.flushHeaders();

    const clientId = randomUUID();

    // ── Write helper ─────────────────────────────────────────────────────────
    const write = (event: SSEEvent): void => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      // Force flush for environments that buffer (e.g. nginx)
      if (typeof (res as any).flush === 'function') (res as any).flush();
    };

    // ── Send initial heartbeat so the client knows we're alive ────────────────
    write({
      type: 'queue_updated',
      clinicId,
      payload: { message: 'connected', clientId },
      timestamp: new Date().toISOString(),
    });

    // Register client with the SSEService
    sseService.addClient(clientId, clinicId, write);

    // ── Heartbeat every 30s to prevent proxy timeouts ─────────────────────────
    const heartbeatInterval = setInterval(() => {
      res.write(': heartbeat\n\n');
      if (typeof (res as any).flush === 'function') (res as any).flush();
    }, 30_000);

    // ── Cleanup on disconnect ─────────────────────────────────────────────────
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      sseService.removeClient(clientId);
    });
  }
}
