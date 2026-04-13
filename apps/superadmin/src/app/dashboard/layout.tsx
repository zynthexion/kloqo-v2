'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/sidebar';
import { Button } from '@/components/ui/button';
import { LogOut, AlertTriangle } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isSuperAdmin, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user || !isSuperAdmin) {
      console.warn("Unauthorized access to Super Admin dashboard. Redirecting to appropriate operational portal.");
      
      // If a Clinic Admin hits the Super Admin URL, teleport them to the Admin App (port 3006)
      if ((user as any)?.roles?.includes('clinicAdmin') || (user as any)?.role === 'clinicAdmin') {
        window.location.href = 'http://localhost:3006/dashboard';
        return;
      }

      // If a Nurse/Pharmacists hits the Super Admin URL, teleport them to the Nurse App (port 3005)
      const isNurse = (user as any)?.roles?.some((r: string) => ['nurse', 'doctor', 'pharmacist', 'receptionist'].includes(r));
      if (isNurse || ['nurse', 'doctor', 'pharmacist', 'receptionist'].includes((user as any)?.role)) {
        window.location.href = 'http://localhost:3005/dashboard';
        return;
      }

      // If a Patient hits the Super Admin URL, teleport them to the Patient App (port 3003)
      if ((user as any)?.role === 'patient') {
        window.location.href = 'http://localhost:3003/dashboard';
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

