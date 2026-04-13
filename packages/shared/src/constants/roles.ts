
/**
 * Single Source of Truth for Roles in the Kloqo Ecosystem.
 * Using 'as const' ensures literal type preservation for strict TypeScript checks.
 */
export const KLOQO_ROLES = {
  SUPER_ADMIN: 'superAdmin',
  CLINIC_ADMIN: 'clinicAdmin',
  DOCTOR: 'doctor',
  NURSE: 'nurse',
  PHARMACIST: 'pharmacist',
  RECEPTIONIST: 'receptionist',
  PATIENT: 'patient'
} as const;

/**
 * Union type of all valid roles.
 * Derived directly from the KLOQO_ROLES object.
 */
export type KloqoRole = typeof KLOQO_ROLES[keyof typeof KLOQO_ROLES];
