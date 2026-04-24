import { User, Role, KloqoRole, KLOQO_ROLES } from '../index';

export const RBACUtils = {
  /**
   * Normalizes old 'role' string and new 'roles' array into a single standardized KloqoRole array.
   * Handles legacy mapping (e.g., admin -> clinicAdmin).
   */
  getNormalizedRoles(user: User | null | undefined): KloqoRole[] {
    if (!user) return [];

    const rawRoles = Array.isArray(user.roles) 
      ? user.roles 
      : (user.role ? [user.role] : []);

    const normalized = rawRoles.map(r => {
      // Legacy Mappings
      if (r === 'admin' as any) return KLOQO_ROLES.CLINIC_ADMIN;
      if (r === 'super-admin' as any) return KLOQO_ROLES.SUPER_ADMIN;
      if (r === 'superadmin' as any) return KLOQO_ROLES.SUPER_ADMIN;
      return r as KloqoRole;
    });

    // Remove duplicates
    return Array.from(new Set(normalized));
  },

  /**
   * Checks if a user has a specific role using Normalized logic.
   */
  hasRole(user: User | null | undefined, targetRole: KloqoRole): boolean {
    const roles = this.getNormalizedRoles(user);
    return roles.includes(targetRole);
  },

  /**
   * Checks if a user has at least one of the allowed roles using Normalized logic.
   */
  hasAnyRole(user: User | null | undefined, allowedRoles: KloqoRole[]): boolean {
    if (!user || !allowedRoles || allowedRoles.length === 0) return false;
    const userRoles = this.getNormalizedRoles(user);
    return allowedRoles.some(role => userRoles.includes(role));
  },

  /**
   * Checks if a user possesses every role in the required list using Normalized logic.
   */
  hasAllRoles(user: User | null | undefined, requiredRoles: KloqoRole[]): boolean {
    if (!user || !requiredRoles || requiredRoles.length === 0) return false;
    const userRoles = this.getNormalizedRoles(user);
    return requiredRoles.every(role => userRoles.includes(role));
  },

  /**
   * Returns the standardized menu list for a given role.
   * This is used as a fallback when database-specific overrides are absent.
   */
  getRoleMenus(role: Role): string[] {
    switch (role) {
      case 'doctor':
        return [
          '/dashboard', 
          '/appointments', 
          '/patients', 
          '/prescriptions', 
          '/live-status', 
          '/slot-visualizer',
          '/day-snapshot',
          '/settings'
        ];
      case 'nurse':
        return [
          '/dashboard', 
          '/appointments', 
          '/patients', 
          '/live-status', 
          '/slot-visualizer'
        ];
      case 'clinicAdmin':
      case 'superAdmin':
        return [
          '/dashboard',
          '/dashboard/reports/providers',
          '/appointments',
          '/doctors',
          '/patients',
          '/departments',
          '/prescriptions',
          '/staff',
          '/live-status',
          '/slot-visualizer',
        ];
      default:
        return ['/dashboard'];
    }
  },

  /**
   * Hardware-Bound RBAC: Defines approved viewport sizes by role.
   */
  getAllowedViewports(role: Role): ('desktop' | 'tablet' | 'mobile')[] {
    switch (role) {
      case 'pharmacist':
      case 'clinicAdmin':
      case 'superAdmin':
        return ['desktop', 'tablet', 'mobile'];
      case 'doctor':
        return ['desktop', 'tablet', 'mobile'];
      case 'nurse':
        return ['desktop', 'tablet', 'mobile'];
      case 'receptionist':
        return ['mobile'];
      default:
        return ['mobile'];
    }
  },

  /**
   * Evaluates if a given role is permitted on the current device width.
   * Standard Viewport Thresholds:
   * - Desktop: >= 1024px
   * - Tablet: >= 768px and < 1024px
   * - Mobile: < 768px
   */
  isViewportAllowed(role: Role, width: number): boolean {
    const allowed = this.getAllowedViewports(role);
    let current: 'desktop' | 'tablet' | 'mobile';

    if (width >= 1024) current = 'desktop';
    else if (width >= 768) current = 'tablet';
    else current = 'mobile';

    return allowed.includes(current);
  }
};
