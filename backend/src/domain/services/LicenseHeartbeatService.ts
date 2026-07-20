/**
 * LicenseHeartbeatService.ts
 *
 * SaaS License Enforcement for Standalone Local Kloqo Deployments.
 *
 * This service runs a background check (every 24 hours and on backend boot)
 * that pings the Kloqo Cloud License API to verify the clinic's monthly
 * subscription status.
 *
 * How it works:
 *   - Active subscription  → Local DB updated, all Kloqo features remain unlocked.
 *   - Subscription expired → Local DB updated with 'suspended' status.
 *                            A 7-day grace period gives the clinic time to renew
 *                            before the system locks non-critical operations.
 *   - Internet unavailable → Cached local status is used. If the clinic has been
 *                            offline for >7 days and the last known status was
 *                            'suspended', the system enforces the lock.
 *
 * From an investor perspective, this mechanism ensures:
 *   - MRR is directly enforced at the software level (no payment = no access).
 *   - The monthly subscription is the SaaS "gate" even for on-premise software.
 */

import https from 'https';
import { ISubscriptionRepository } from '../repositories';

// ── Heartbeat Response (from Kloqo Cloud License API) ─────────────────────
interface HeartbeatResponse {
  active: boolean;
  status: 'active' | 'suspended' | 'grace_period';
  plan: string;
  validUntil: string; // ISO 8601 string
  gracePeriodEndsAt?: string; // ISO 8601 string (only when in grace_period)
}

export class LicenseHeartbeatService {
  private readonly CLOUD_API_BASE = process.env.KLOQO_CLOUD_API_URL || 'https://api.kloqo.com';
  private readonly CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly GRACE_PERIOD_DAYS = 7;

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly clinicId: string,
  ) {}

  /**
   * start() — Kicks off the 24-hour recurring heartbeat check.
   * Call this once from Container.ts when the backend boots.
   */
  async start(): Promise<void> {
    console.log(`[LicenseHeartbeat] Starting license monitoring for clinic: ${this.clinicId}`);

    // Run an immediate check on startup
    await this.runCheck();

    // Then schedule recurring 24-hour checks
    this.timer = setInterval(() => {
      this.runCheck().catch((err) =>
        console.error('[LicenseHeartbeat] Scheduled check failed:', err.message)
      );
    }, this.CHECK_INTERVAL_MS);

    console.log(`[LicenseHeartbeat] Next check scheduled in 24 hours.`);
  }

  /**
   * stop() — Clears the scheduled interval. Call on graceful shutdown.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[LicenseHeartbeat] Stopped.');
    }
  }

  /**
   * runCheck() — The core heartbeat logic.
   * Pings the Cloud API and updates the local subscription record.
   */
  async runCheck(): Promise<void> {
    console.log(`[LicenseHeartbeat] Checking subscription status with cloud...`);

    try {
      const response = await this.pingCloudLicenseServer();

      // Update local subscription record with cloud-confirmed status
      const existingSubscription = await this.subscriptionRepo.findByClinicId(this.clinicId);

      if (existingSubscription) {
        await this.subscriptionRepo.update(existingSubscription.id, this.clinicId, {
          status: response.status === 'active' ? 'active' : 'cancelled',
          // Store when the next check must happen at the latest
          updatedAt: new Date() as any,
        });
      }

      if (response.active) {
        console.log(`[LicenseHeartbeat] ✅ License ACTIVE. Plan: ${response.plan}. Valid until: ${response.validUntil}`);
      } else if (response.status === 'grace_period') {
        console.warn(`[LicenseHeartbeat] ⚠️  License in GRACE PERIOD. Expires: ${response.gracePeriodEndsAt}. Please renew the subscription.`);
      } else {
        console.error(`[LicenseHeartbeat] ❌ License SUSPENDED. Kloqo will restrict operations. Please contact support.`);
      }
    } catch (err: any) {
      // ── Offline Fallback ─────────────────────────────────────────────────
      // If the internet is down, we don't immediately lock the system.
      // We rely on the locally-cached subscription status.
      // The 7-day grace period handles extended outages.
      console.warn(`[LicenseHeartbeat] ⚡ Cloud unreachable: ${err.message}. Using cached local subscription status.`);
    }
  }

  /**
   * isLocallyActive() — Fast synchronous check used by the license middleware.
   * Reads from the local subscription cache — does NOT make a network call.
   */
  async isLocallyActive(): Promise<{ active: boolean; reason?: string }> {
    try {
      const sub = await this.subscriptionRepo.findByClinicId(this.clinicId);

      if (!sub) {
        return { active: false, reason: 'No subscription record found. Please complete the initial setup.' };
      }

      if (sub.status === 'active') {
        return { active: true };
      }

      // Check if grace period is still valid
      if (sub.status === 'cancelled' || sub.status === 'past_due') {
        const updatedAt = sub.updatedAt ? new Date(sub.updatedAt) : new Date(0);
        const daysSinceLastSync = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceLastSync <= this.GRACE_PERIOD_DAYS) {
          console.warn(`[LicenseHeartbeat] Grace period: ${Math.round(daysSinceLastSync)} / ${this.GRACE_PERIOD_DAYS} days used.`);
          return { active: true }; // Still in grace period
        }

        return {
          active: false,
          reason: `Subscription expired. Grace period of ${this.GRACE_PERIOD_DAYS} days has ended. Please renew your Kloqo subscription at https://kloqo.com/billing.`,
        };
      }

      return { active: false, reason: `Subscription status is "${sub.status}". Please contact Kloqo support.` };
    } catch (err: any) {
      // If there's a local DB error reading the subscription, allow access as a failsafe
      // to avoid locking a clinic out due to a local data bug.
      console.error('[LicenseHeartbeat] Error reading local subscription:', err.message);
      return { active: true };
    }
  }

  // ── Private: Ping Cloud License API ────────────────────────────────────────
  private pingCloudLicenseServer(): Promise<HeartbeatResponse> {
    return new Promise((resolve, reject) => {
      const licenseKey = process.env.LOCAL_LICENSE_KEY || '';
      const url = `${this.CLOUD_API_BASE}/v1/license/verify?clinicId=${encodeURIComponent(this.clinicId)}&key=${encodeURIComponent(licenseKey)}`;

      const req = https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`License API returned HTTP ${res.statusCode}`));
              return;
            }
            resolve(JSON.parse(data) as HeartbeatResponse);
          } catch {
            reject(new Error('Failed to parse license response'));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('License check timed out after 10s'));
      });
    });
  }
}
