import { Request, Response, NextFunction } from 'express';
import { VerifySessionUseCase } from '../../../application/VerifySessionUseCase';
import { RBACUtils, KloqoRole, KLOQO_ROLES } from '@kloqo/shared';

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
