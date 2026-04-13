'use client';

import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { RBACUtils, Role } from "@kloqo/shared";

export function AppGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // Public routes are exempt
    if (pathname === '/login' || pathname === '/') return;

    if (!user) return;

    // RBAC Guard: Ensure user has patient status for THIS app
    const isPatient = RBACUtils.hasAnyRole(user, ['patient'] as Role[]);
    
    if (!isPatient) {
      console.warn("Unauthorized access to Patient App. Redirecting to staff portal.");
      
      // If a Nurse/Pharmacists hits the Patient App, teleport them to the Nurse App (port 3005)
      if (RBACUtils.hasAnyRole(user, ['nurse', 'doctor', 'pharmacist', 'receptionist'] as Role[])) {
        window.location.href = 'http://localhost:3005/dashboard';
        return;
      }

      // If a Clinic Admin hits the Patient App, teleport them to the Admin App (port 3006)
      if (RBACUtils.hasAnyRole(user, ['clinicAdmin', 'admin'] as Role[])) {
        window.location.href = 'http://localhost:3006/dashboard';
        return;
      }

      // If a Super Admin hits the Patient App, teleport them to the Super Admin App (port 3004)
      if (RBACUtils.hasAnyRole(user, ['superAdmin', 'super-admin'] as Role[])) {
        window.location.href = 'http://localhost:3004/dashboard';
        return;
      }
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
