
"use client";

import { Sidebar } from '@/components/layout/sidebar';
import { OnboardingCheck } from '@/components/onboarding/onboarding-check';
import { Suspense, useEffect, useState } from 'react';
import { useAuth, AuthProvider } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useClinicSync } from '@/hooks/use-clinic-sync';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlobalErrorHandler } from '@/components/GlobalErrorHandler';
import { apiRequest } from '@/lib/api-client';
import { RBACUtils, Role } from '@kloqo/shared';

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

  useEffect(() => {
    if (loading) return;

    if (!currentUser) {
      router.push('/');
      return;
    }

    // RBAC Guard: Ensure user has administrative privileges for THIS app
    const isAdmin = RBACUtils.hasAnyRole(currentUser, ['clinicAdmin', 'admin', 'superAdmin', 'super-admin'] as Role[]);
    
    if (!isAdmin) {
      console.warn("Unauthorized access to Clinic Admin app. Redirecting to appropriate operational portal.");
      
      // Intelligent Redirection to avoid infinite loops
      // If a Nurse/Pharmacists hits the Admin URL, teleport them to the Nurse App
      if (RBACUtils.hasAnyRole(currentUser, ['nurse', 'doctor', 'pharmacist', 'receptionist'] as Role[])) {
        window.location.href = 'http://localhost:3005/dashboard'; 
        return;
      }

      // If a Patient hits the Admin URL, teleport them to the Patient App
      if (RBACUtils.hasAnyRole(currentUser, ['patient'] as Role[])) {
        window.location.href = 'http://localhost:3003/dashboard';
        return;
      }

      // If we don't know who they are, send to logout to clear the session and break the loop
      console.error("Unknown role detected. Clearing session.");
      logout();
      return;
    }

    if (!currentUser.clinicId) {
      console.error("No clinicId found for user. Logging out.");
      logout();
      router.push('/');
      return;
    }

    const verifyStatus = async () => {
      try {
        // If already on registration-status or onboarding, we don't need to double-check here
        // as the components themselves handle their own state properly.
        if (pathname === '/registration-status' || pathname === '/onboarding') {
          setIsVerifying(false);
          return;
        }

        const clinicData = await apiRequest<any>("/clinic/me");
        
        if (clinicData) {
          const registrationStatus = clinicData.registrationStatus;
          const onboardingStatus = clinicData.onboardingStatus;

          // Block access if not explicitly 'Approved' — mirrors backend enforcement
          if (registrationStatus !== 'Approved') {
            router.push('/registration-status');
            return;
          }
          
          // Block access if onboarding not explicitly 'Completed' — mirrors backend enforcement
          // This catches null, undefined, 'Pending', 'Incomplete', etc.
          if (onboardingStatus !== 'Completed') {
            router.push('/onboarding');
            return;
          }
        }
        
        setIsVerifying(false);
      } catch (error: any) {
        console.error("Failed to fetch dashboard data:", error);
        // If the API explicitly says not approved or onboarding incomplete, redirect
        if (error.message === 'Clinic is not approved by Superadmin' || 
            error.message === 'Clinic onboarding is incomplete') {
          router.push('/registration-status');
          return;
        }

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
