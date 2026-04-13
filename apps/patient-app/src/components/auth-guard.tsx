'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SplashScreen } from '@/components/splash-screen';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard component that protects routes by redirecting unauthenticated users to login.
 * V2 Architecture: Authentication is validated via JWT; we trust user.patientId presence.
 * No direct Firestore lookups are performed here.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading: userLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const redirectingRef = useRef(false);

  const redirectToLogin = () => {
    if (redirectingRef.current) return;
    if (pathname === '/login') return;
    if (typeof window !== 'undefined' && window.location.pathname === '/login') return;

    redirectingRef.current = true;

    const currentPath = pathname;
    const currentQuery = searchParams.toString();
    const fullPath = currentQuery ? `${currentPath}?${currentQuery}` : currentPath;

    if (typeof window !== 'undefined') {
      localStorage.setItem('redirectAfterLogin', fullPath);

      const loginParams = new URLSearchParams();
      const paramsToPreserve = ['clinicId', 'magicToken', 'token', 'ref', 'source', 'medium', 'campaign', 'appt'];
      paramsToPreserve.forEach(paramName => {
        const value = searchParams.get(paramName);
        if (value) loginParams.set(paramName, value);
      });

      const loginUrl = loginParams.toString() ? `/login?${loginParams.toString()}` : '/login';
      window.location.replace(loginUrl);
    } else {
      router.replace('/login');
    }
  };

  const exemptedPrefixes = [
    '/login',
    '/patient-form',
    '/clinics',
    '/doctors',
    '/contact',
    '/privacy',
    '/terms',
    '/live-token',
    '/home',
    '/book-appointment'
  ];

  const isExempted = pathname === '/' || exemptedPrefixes.some(prefix => 
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  useEffect(() => {
    if (isExempted) {
      return;
    }
    
    if (redirectingRef.current) return;
    if (userLoading) {
      console.log(`[AuthGuard] User still loading...`);
      return;
    }
    
    // Case 1: Not logged in at all
    if (!user) {
      console.warn(`[AuthGuard] No user session for protected path ${pathname}. Redirecting to login...`);
      redirectToLogin();
      return;
    }

    console.log(`[AuthGuard] Authorized for ${pathname}. User:`, user.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading, pathname, isExempted]);

  // Skip guard on login and registration pages
  if (pathname === '/login' || pathname.startsWith('/login') || pathname === '/patient-form' || pathname.startsWith('/patient-form')) {
    return <>{children}</>;
  }

  // Show splash while redirecting
  if (redirectingRef.current) {
    return <SplashScreen />;
  }

  // Show splash while auth is loading
  if (userLoading && !user && !isExempted) {
    return <SplashScreen />;
  }

  // Trigger redirect if protected path and no user after loading
  if (!userLoading && !user && !isExempted && !redirectingRef.current) {
    redirectToLogin();
  }

  return <>{children}</>;
}
