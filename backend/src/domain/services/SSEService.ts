/**
 * SSEService — Domain Service (pure, no I/O, no Express dependency)
 *
 * Acts as an in-process event broker. Controllers call `broadcast()` after
 * any state-changing operation. The SSEController manages the raw HTTP streams.
 *
 * Rule: This file has zero framework imports. It is a pure pub/sub registry.
 */

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

export interface SSEEvent {
  type: SSEEventType;
  clinicId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

type SSEClient = {
  id: string;
  clinicId: string;
  /** Raw write function provided by the transport layer (Express controller) */
  write: (event: SSEEvent) => void;
};

export class SSEService {
  private clients: Map<string, SSEClient> = new Map();

  /** Register a new SSE client connection */
  addClient(id: string, clinicId: string, write: (event: SSEEvent) => void): void {
    this.clients.set(id, { id, clinicId, write });
    console.log(`[SSE] Client connected: ${id} for clinic ${clinicId}. Total: ${this.clients.size}`);
  }

  /** Remove a client (called when the HTTP connection closes) */
  removeClient(id: string): void {
    this.clients.delete(id);
    console.log(`[SSE] Client disconnected: ${id}. Total: ${this.clients.size}`);
  }

  /** Broadcast an event to all clients watching a specific clinic */
  broadcast(event: SSEEvent): void {
    let sent = 0;
    this.clients.forEach((client) => {
      if (client.clinicId === event.clinicId) {
        try {
          client.write(event);
          sent++;
        } catch (err) {
          console.error(`[SSE] Failed to write to client ${client.id}:`, err);
          this.removeClient(client.id);
        }
      }
    });
    if (sent > 0) {
      console.log(`[SSE] Broadcast '${event.type}' to ${sent} client(s) for clinic ${event.clinicId}`);
    }
  }

  /** Convenience: build and broadcast in one call */
  emit(type: SSEEventType, clinicId: string, payload: Record<string, unknown>): void {
    this.broadcast({
      type,
      clinicId,
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  getClientCount(clinicId?: string): number {
    if (!clinicId) return this.clients.size;
    let count = 0;
    this.clients.forEach((c) => { if (c.clinicId === clinicId) count++; });
    return count;
  }
}

/** Singleton — single instance shared across the entire process */
export const sseService = new SSEService();
