"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

export function OnboardingCheck() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!currentUser || loading) return;
    
    // If the user is already on the onboarding or registration-status page, don't do anything.
    if (pathname === '/onboarding' || pathname === '/registration-status') return;

    const checkOnboardingStatus = async () => {
      try {
        const clinicData = await apiRequest<any>("/clinic/me");

        if (clinicData) {
          const registrationStatus = clinicData.registrationStatus;
          
          if (registrationStatus === 'Pending' || registrationStatus === 'Rejected') {
            router.push('/registration-status');
            return;
          }
          
          // Only check onboarding status if registration is approved (or not set for backward compatibility)
          if (registrationStatus === 'Approved' || !registrationStatus) {
            if (clinicData.onboardingStatus === "Pending") {
              router.push('/onboarding');
            }
          }
        } else {
          // No clinic found, go to onboarding
          router.push('/onboarding');
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      }
    };

    checkOnboardingStatus();

  }, [currentUser, loading, router, pathname]);

  return null;
}
