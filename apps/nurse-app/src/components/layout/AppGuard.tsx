'use client';

import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RBACUtils, Role } from "@kloqo/shared";
import { useActiveIdentity } from "@/hooks/useActiveIdentity";

export function AppGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { activeRole } = useActiveIdentity();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Public routes are exempt
    if (pathname === '/login') return;

    if (!user) return;

    // 1. GLOBAL ACCESS CHECK: Ensure user has ANY operational staff privilege
    const isStaff = RBACUtils.hasAnyRole(user, ['nurse', 'doctor', 'pharmacist', 'receptionist', 'clinicAdmin', 'superAdmin'] as Role[]);
    
    if (!isStaff) {
      console.warn("Unauthorized access to Nurse App. Redirecting to patient portal.");
      if (RBACUtils.hasAnyRole(user, ['patient'] as Role[])) {
        const patientUrl = process.env.NEXT_PUBLIC_PATIENT_URL || 'http://localhost:3003';
        window.location.href = `${patientUrl}/dashboard`;
        return;
      }
    }

    // 2. ACTIVE CONTEXT ENFORCEMENT: Reactive Whitelist & Defense in Depth
    if (activeRole) {
      // 💊 PHARMACIST BOUNDARY: Fulfillment Queue Only
      if (activeRole === 'pharmacist') {
        const allowedPaths = ['/prescriptions', '/settings', '/login', '/'];
        const isAllowed = allowedPaths.some(p => pathname === p || (p !== '/' && pathname.startsWith(p)));
        
        if (!isAllowed) {
          console.warn("[Security] Reactive Guard: Pharmacist attempted unauthorized clinical access. Redirecting.");
          router.replace('/prescriptions');
          return;
        }
      }

      // 🏥 CLINICAL BOUNDARY: Dashboard, Walk-in & Patient History
      if (activeRole === 'nurse' || activeRole === 'doctor') {
        const allowedClinicalPaths = ['/dashboard', '/walk-in', '/appointments', '/patients', '/settings', '/schedule-break', '/schedule-override', '/login', '/'];
        const isAllowed = allowedClinicalPaths.some(p => pathname === p || (p !== '/' && pathname.startsWith(p)));
        
        if (!isAllowed) {
          console.warn("[Security] Reactive Guard: Clinical staff attempted unauthorized access. Redirecting to dashboard.");
          router.replace('/dashboard');
          return;
        }
      }

      // 📞 RECEPTIONIST BOUNDARY: Home & Phone Booking Only
      if (activeRole === 'receptionist') {
        const allowedReceptionistPaths = ['/', '/phone-booking', '/patient-form', '/settings', '/login'];
        const isAllowed = allowedReceptionistPaths.some(p => pathname === p || (p !== '/' && pathname.startsWith(p)));
        
        if (!isAllowed) {
          console.warn("[Security] Reactive Guard: Receptionist attempted clinical dashboard access. Redirecting home.");
          router.replace('/');
          return;
        }
      }
    }
  }, [user, loading, pathname, activeRole, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
