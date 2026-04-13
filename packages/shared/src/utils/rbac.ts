import { User, Role } from '../index';

export const RBACUtils = {
  /**
   * Checks if a user has a specific role using Dual-Read logic.
   */
  hasRole(user: User | null | undefined, targetRole: Role): boolean {
    if (!user) return false;
    
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles.includes(targetRole);
    }
    
    return user.role === targetRole;
  },

  /**
   * Checks if a user has at least one of the allowed roles using Dual-Read logic.
   */
  hasAnyRole(user: User | null | undefined, allowedRoles: Role[]): boolean {
    if (!user || !allowedRoles || allowedRoles.length === 0) return false;
    
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles.some(r => allowedRoles.includes(r));
    }
    
    return allowedRoles.includes(user.role);
  },

  /**
   * Checks if a user possesses every role in the required list using Dual-Read logic.
   */
  hasAllRoles(user: User | null | undefined, requiredRoles: Role[]): boolean {
    if (!user || !requiredRoles || requiredRoles.length === 0) return false;
    
    if (user.roles && Array.isArray(user.roles)) {
      return requiredRoles.every(r => user.roles!.includes(r));
    }
    
    // If the required roles requires more than 1 role but they only have 1 deprecated role string, it's false
    if (requiredRoles.length > 1) {
        return false;
    }
    
    return requiredRoles.includes(user.role);
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
          '/slot-visualizer'
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
        return ['desktop', 'tablet'];
      case 'nurse':
        return ['tablet', 'mobile'];
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
