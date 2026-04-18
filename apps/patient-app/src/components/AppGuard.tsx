'use client';

import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { RBACUtils, Role, KLOQO_ROLES } from "@kloqo/shared";

export function AppGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // Public routes are exempt
    if (pathname === '/login' || pathname === '/') return;

    if (!user) return;

    // RBAC Guard: Ensure user has patient status for THIS app
    const { PATIENT, NURSE, DOCTOR, PHARMACIST, RECEPTIONIST, CLINIC_ADMIN, SUPER_ADMIN } = KLOQO_ROLES;
    const isPatient = RBACUtils.hasAnyRole(user, [PATIENT] as Role[]);
    
    if (isPatient) {
      // SUCCEED FAST: If they are a patient, we allow access immediately.
      return;
    }

    console.warn("Unauthorized access to Patient App. Evaluating redirect portal.");
    
    // REDIRECT LOGIC: Only runs if the user FAILED the patient check.
    
    // If a Nurse/Pharmacist/Receptionist hits the Patient App, teleport them to the Nurse App
    if (RBACUtils.hasAnyRole(user, [NURSE, DOCTOR, PHARMACIST, RECEPTIONIST] as Role[])) {
      const nurseUrl = process.env.NEXT_PUBLIC_NURSE_URL;
      if (!nurseUrl) {
        console.error('[AppGuard] NEXT_PUBLIC_NURSE_URL is not configured. Cannot redirect staff.');
        return;
      }
      window.location.href = `${nurseUrl}/dashboard`;
      return;
    }

    // If a Clinic Admin hits the Patient App, teleport them to the Admin App
    if (RBACUtils.hasAnyRole(user, [CLINIC_ADMIN] as Role[])) {
      const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
      if (!adminUrl) {
        console.error('[AppGuard] NEXT_PUBLIC_ADMIN_URL is not configured. Cannot redirect admin.');
        return;
      }
      window.location.href = `${adminUrl}/dashboard`;
      return;
    }

    // If a Super Admin hits the Patient App, teleport them to the Super Admin App
    if (RBACUtils.hasAnyRole(user, [SUPER_ADMIN] as Role[])) {
      const superAdminUrl = process.env.NEXT_PUBLIC_SUPERADMIN_URL;
      if (!superAdminUrl) {
        console.error('[AppGuard] NEXT_PUBLIC_SUPERADMIN_URL is not configured. Cannot redirect super admin.');
        return;
      }
      window.location.href = `${superAdminUrl}/dashboard`;
      return;
    }
  }, [user, loading, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white/50 backdrop-blur-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
