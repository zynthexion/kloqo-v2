'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, AlertTriangle } from 'lucide-react';
import { RBACUtils, Role, KLOQO_ROLES } from '@kloqo/shared';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isSuperAdmin, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (isSuperAdmin) {
      // SUCCEED FAST: If they are a Super Admin, we trust the AuthContext and allow access.
      return;
    }

    console.warn("Unauthorized access to Super Admin dashboard. Evaluating redirect portal.");
    
    // REDIRECT LOGIC: Only runs if the user FAILED the Super Admin check.
    const { CLINIC_ADMIN, NURSE, DOCTOR, PHARMACIST, RECEPTIONIST, PATIENT } = KLOQO_ROLES;

    // If a Clinic Admin hits the Super Admin URL, teleport them to the Admin App
    if (RBACUtils.hasAnyRole(user as any, [CLINIC_ADMIN])) {
      const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3006';
      window.location.href = `${adminUrl}/dashboard`;
      return;
    }

    // If a Nurse/Pharmacist/Receptionist hits the Super Admin URL, teleport them to the Nurse App
    if (RBACUtils.hasAnyRole(user as any, [NURSE, DOCTOR, PHARMACIST, RECEPTIONIST])) {
      const nurseUrl = process.env.NEXT_PUBLIC_NURSE_URL || 'http://localhost:3005';
      window.location.href = `${nurseUrl}/dashboard`;
      return;
    }

    // If a Patient hits the Super Admin URL, teleport them to the Patient App
    if (RBACUtils.hasAnyRole(user as any, [PATIENT])) {
      const patientUrl = process.env.NEXT_PUBLIC_PATIENT_URL || 'http://localhost:3003';
      window.location.href = `${patientUrl}/dashboard`;
      return;
    }

      // Default fallback
      router.push('/');
    }
  }, [user, loading, isSuperAdmin, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Kloqo SuperAdmin</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

