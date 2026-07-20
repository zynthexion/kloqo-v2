import { Request, Response, NextFunction } from 'express';
import { VerifySessionUseCase } from '../../../application/VerifySessionUseCase';
import { RBACUtils, KloqoRole, KLOQO_ROLES } from '@kloqo/shared';
import { LicenseHeartbeatService } from '../../../domain/services/LicenseHeartbeatService';

/**
 * Middleware factory — requires VerifySessionUseCase to be passed in.
 * This keeps middleware testable and avoids circular imports.
 *
 * Usage in routes:
 *   const { auth, checkRole, checkPermission } = createMiddleware(verifySessionUseCase);
 */
export function createMiddleware(verifySessionUseCase: VerifySessionUseCase) {
  /**
   * authenticateToken — validates the JWT Bearer token.
   * Attaches the decoded user to req.user on success.
   */
  const auth = async (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    try {
      const user = await verifySessionUseCase.execute(token);
      req.user = user;
      next();
    } catch (error: any) {
      console.error('[Auth] Token verification failed:', error.message);
      return res.status(403).json({ error: 'Forbidden', message: 'Invalid or expired token' });
    }
  };

  /**
   * checkRole(...roles) — role-based access control (RBAC).
   */
  const checkRole = (...roles: KloqoRole[]) => (req: any, res: Response, next: NextFunction) => {
    if (!req.user || !RBACUtils.hasAnyRole(req.user, roles)) {
      return res.status(403).json({ error: 'Access Denied: Insufficient Permissions' });
    }
    next();
  };

  /**
   * checkPermission(menuKey) — granular menu-based permission check.
   * Root 'superAdmin' has full access.
   * Staff 'superAdmin' check accessibleMenus array.
   */
  const checkPermission = (menuKey: string) => (req: any, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Root superAdmin global override
    if (RBACUtils.hasRole(req.user, KLOQO_ROLES.SUPER_ADMIN)) return next();

    // Staff permission check
    const hasAccess = req.user.accessibleMenus?.includes(menuKey);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden', message: `No access to module: ${menuKey}` });
    }

    next();
  };

  return { auth, checkRole, checkPermission };
}

// ── Local Standalone License Middleware ─────────────────────────────────────

/**
 * createLicenseMiddleware
 *
 * Factory for the SaaS license enforcement middleware used in standalone
 * local Kloqo deployments. When called, it returns an Express middleware
 * function that checks if the clinic's monthly subscription is valid before
 * allowing any protected API call.
 *
 * The check uses the locally-cached subscription status (updated every 24h by
 * LicenseHeartbeatService) — it does NOT make a network call on every request.
 *
 * A 7-day grace period is respected before the system goes into lockdown.
 *
 * Usage (in index.ts for local mode):
 *   const verifyLicense = createLicenseMiddleware(licenseHeartbeatService);
 *   app.use('/appointments', verifyLicense, appointmentRoutes);
 *
 * HTTP Responses:
 *   - 402 Payment Required → Subscription expired and grace period ended.
 *   - Passes through        → Subscription is active or in grace period.
 */
export function createLicenseMiddleware(heartbeatService: LicenseHeartbeatService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Always allow the health check, seed, and license sync endpoints
    // so clinic staff can troubleshoot connectivity even when locked.
    const alwaysAllowedPaths = ['/health', '/api/v1/system/seed-local', '/api/v1/system/sync-subscription'];
    if (alwaysAllowedPaths.some((p) => req.path.startsWith(p))) {
      return next();
    }

    const { active, reason } = await heartbeatService.isLocallyActive();

    if (!active) {
      console.warn(`[LicenseMiddleware] Blocked request to ${req.path}: ${reason}`);
      return res.status(402).json({
        error: 'Subscription Required',
        message: reason,
        code: 'LICENSE_EXPIRED',
        renewUrl: 'https://kloqo.com/billing',
      });
    }

    next();
  };
}

