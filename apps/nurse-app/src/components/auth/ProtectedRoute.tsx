'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Role, RBACUtils } from '@kloqo/shared';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

/**
 * ProtectedRoute component that gates access based on the new Role[] array.
 * Uses RBACUtils for Dual-Read compatibility.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (allowedRoles && !RBACUtils.hasAnyRole(user, allowedRoles)) {
        // If they have no access, redirect to their primary landing page
        const hasClinicalAccess = RBACUtils.hasAnyRole(user, ['nurse', 'doctor', 'receptionist', 'clinicAdmin', 'superAdmin']);
        if (hasClinicalAccess) {
          router.replace('/dashboard');
        } else if (RBACUtils.hasRole(user, 'pharmacist')) {
          router.replace('/prescriptions');
        } else {
          router.replace('/login');
        }
      }
    }
  }, [user, loading, allowedRoles, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-theme-blue" />
      </div>
    );
  }

  if (!user || (allowedRoles && !RBACUtils.hasAnyRole(user, allowedRoles))) {
    return null;
  }

  return <>{children}</>;
}
