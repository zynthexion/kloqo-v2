
"use client";

import { Sidebar } from '@/components/layout/sidebar';
import { OnboardingCheck } from '@/components/onboarding/onboarding-check';
import { Suspense, useEffect, useState, useRef } from 'react';
import { useAuth, AuthProvider } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useClinicSync } from '@/hooks/use-clinic-sync';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlobalErrorHandler } from '@/components/GlobalErrorHandler';
import { apiRequest } from '@/lib/api-client';
import { RBACUtils, Role, KLOQO_ROLES } from '@kloqo/shared';

function AuthorizedLayout({ children }: { children: React.ReactNode }) {
  // Centralized background sync for clinic/doctor/appointment statuses
  useClinicSync();

  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><p>Loading...</p></div>}>
      <ErrorBoundary>
        <div className="flex h-full">
          <OnboardingCheck />
          <GlobalErrorHandler />
          <Sidebar />
          <div className="flex-1 flex flex-col h-full overflow-y-auto">
            {children}
          </div>
        </div>
      </ErrorBoundary>
    </Suspense>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  const { currentUser, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isVerifying, setIsVerifying] = useState(true);
  const hasVerified = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (!currentUser) {
      router.push('/');
      return;
    }

    // RBAC Guard: Ensure user has administrative privileges for THIS app
    const { CLINIC_ADMIN, SUPER_ADMIN, NURSE, DOCTOR, PHARMACIST, RECEPTIONIST, PATIENT } = KLOQO_ROLES;
    const isAdmin = RBACUtils.hasAnyRole(currentUser, [CLINIC_ADMIN, SUPER_ADMIN] as Role[]);
    
    if (!isAdmin) {
      if (RBACUtils.hasAnyRole(currentUser, [NURSE, DOCTOR, PHARMACIST, RECEPTIONIST] as Role[])) {
        const nurseUrl = process.env.NEXT_PUBLIC_NURSE_URL;
        if (nurseUrl) window.location.href = `${nurseUrl}/dashboard`; 
        return;
      }

      if (RBACUtils.hasAnyRole(currentUser, [PATIENT] as Role[])) {
        const patientUrl = process.env.NEXT_PUBLIC_PATIENT_URL;
        if (patientUrl) window.location.href = `${patientUrl}/dashboard`;
        return;
      }

      logout();
      return;
    }

    if (!currentUser.clinicId) {
      logout();
      return;
    }

    const verifyStatus = async () => {
      // Avoid re-verifying if we already did it for this mount
      if (hasVerified.current) {
        setIsVerifying(false);
        return;
      }

      try {
        if (pathname === '/registration-status' || pathname === '/onboarding') {
          setIsVerifying(false);
          hasVerified.current = true;
          return;
        }

        const clinicData = await apiRequest<any>("/clinic/me");
        
        if (clinicData) {
          if (clinicData.registrationStatus !== 'Approved') {
            router.push('/registration-status');
            return;
          }
          if (clinicData.onboardingStatus !== 'Completed') {
            router.push('/onboarding');
            return;
          }
        }
        
        setIsVerifying(false);
        hasVerified.current = true;
      } catch (error: any) {
        console.error("Failed to fetch dashboard data:", error);
        setIsVerifying(false);
      }
    };

    verifyStatus();
  }, [currentUser, loading, router, logout, pathname]);

  if (loading || isVerifying) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return <AuthorizedLayout>{children}</AuthorizedLayout>;
}


export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <AppContent>{children}</AppContent>
    </AuthProvider>
  );
}
