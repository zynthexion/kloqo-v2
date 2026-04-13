/**
 * CacheService — Lightweight In-Memory TTL Cache
 *
 * A zero-dependency, singleton wrapper around `node-cache` for caching
 * static/rarely-changing Firestore documents (Clinic Settings, Doctor Profiles).
 *
 * Architecture Note (ARCHITECTURE.md §9):
 *  This lives in `infrastructure/services/` and is injected via `Container.ts`.
 *  Use Cases and Repositories receive it via constructor injection; they NEVER
 *  instantiate it directly.
 *
 * Cache TTLs (tuned for Kloqo's read patterns):
 *  - Clinic Settings : 10 minutes (changes on admin save, rare)
 *  - Doctor Profiles : 5 minutes  (changes during session — status, leave)
 *  - Notification Templates : 60 minutes (static system config)
 */

import NodeCache from 'node-cache';

class CacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 300,          // Default TTL: 5 minutes
      checkperiod: 60,      // Run GC every 60 seconds
      useClones: false,     // Avoid deep-clone overhead for read-heavy workloads
    });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    if (ttlSeconds !== undefined) {
      this.cache.set(key, value, ttlSeconds);
    } else {
      this.cache.set(key, value);
    }
  }

  del(key: string | string[]): void {
    this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
  }

  /** Invalidate all keys matching a prefix. Used for clinic-scoped cache busting. */
  delByPrefix(prefix: string): void {
    const keys = this.cache.keys().filter(k => k.startsWith(prefix));
    if (keys.length > 0) this.cache.del(keys);
  }
}

// Singleton — one cache instance for the entire process lifetime
export const cacheService = new CacheService();

// Standard TTL constants for consistency across repositories
export const CACHE_TTL = {
  CLINIC: 600,          // 10 minutes
  DOCTOR: 300,          // 5 minutes
  NOTIFICATION: 3600,   // 60 minutes
} as const;

export const CACHE_KEY = {
  clinic: (id: string) => `clinic:${id}`,
  doctorsByClinic: (clinicId: string) => `doctors:clinic:${clinicId}`,
  doctor: (id: string) => `doctor:${id}`,
  notificationConfigs: () => `notification:configs`,
} as const;
