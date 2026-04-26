'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, BarChart3, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { useAuth } from '@/contexts/AuthContext';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { NurseDesktopShell } from '@/components/layout/NurseDesktopShell';
import { DoctorProfileSettings } from '@/components/profile/DoctorProfileSettings';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { activeRole, clinicalProfile, isLoading: identityLoading } = useActiveIdentity();

  const handleLogout = async () => {
    try {
      localStorage.removeItem('selectedDoctorId');
      localStorage.removeItem('clinicId');
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isDoctor = activeRole === 'doctor';

  if (identityLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const mobileView = (
    <AppFrameLayout showBottomNav>
      <div className="flex flex-col h-full bg-muted/20 font-pt-sans overflow-y-auto">
        <header className="relative p-6 pb-12 text-white rounded-b-[2.5rem] bg-slate-900 shadow-2xl">
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="text-white hover:bg-white/10 -ml-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-black tracking-tight">Settings</h1>
            </div>
          </div>
          
          <div className="mt-8">
             <RoleSwitcher />
          </div>
        </header>

        <main className="flex-1 p-4 -mt-6 relative z-20">
          {isDoctor ? (
            <DoctorProfileSettings initialData={clinicalProfile} onLogout={handleLogout} />
          ) : (
            <div className="space-y-6">
              <Card className="rounded-[2.5rem] border-none shadow-premium overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <Link href="/day-snapshot">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-white shadow-sm">
                          <BarChart3 className="h-5 w-5 text-indigo-600" />
                        </div>
                        <span className="font-bold text-indigo-900">Day Snapshot</span>
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>

              <Button 
                onClick={handleLogout}
                className="w-full h-16 rounded-[2rem] bg-red-50 hover:bg-red-100 text-red-600 font-black gap-3 shadow-sm transition-all active:scale-95"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </Button>
            </div>
          )}
        </main>
      </div>
    </AppFrameLayout>
  );

  const tabletView = (
    <TabletDashboardLayout 
      hideSidebar={activeRole === 'nurse'}
      hideRightPanel={activeRole === 'nurse'}
    >
      <div className="py-8 animate-in fade-in duration-700 font-pt-sans">
        <header className="mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Settings</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2 px-1">
              {isDoctor ? 'Manage your clinical profile and practice configuration' : 'Manage your account and preferences'}
            </p>
          </div>
          {!isDoctor && <RoleSwitcher />}
        </header>

        {isDoctor ? (
          <DoctorProfileSettings initialData={clinicalProfile} onLogout={handleLogout} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
            <Link href="/day-snapshot">
              <div className="group p-8 rounded-[2.5rem] bg-white border border-slate-50 shadow-premium transition-all duration-500 flex flex-col items-center text-center cursor-pointer hover:shadow-2xl hover:-translate-y-2 active:scale-[0.98]">
                <div className="p-6 rounded-[2rem] bg-indigo-50 text-indigo-600 transition-transform group-hover:rotate-6 mb-6">
                  <BarChart3 className="h-8 w-8" />
                </div>
                <h4 className="text-xl font-black text-slate-900 tracking-tight">Day Snapshot</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Clinic performance summary</p>
              </div>
            </Link>

            <div 
              onClick={handleLogout}
              className="group p-8 rounded-[2.5rem] bg-red-50/50 border border-red-100 shadow-premium transition-all duration-500 flex flex-col items-center text-center cursor-pointer hover:bg-red-50 hover:shadow-2xl hover:-translate-y-2 active:scale-[0.98]"
            >
              <div className="p-6 rounded-[2rem] bg-red-100 text-red-600 mb-6">
                <LogOut className="h-8 w-8" />
              </div>
              <h4 className="text-xl font-black text-red-600 tracking-tight">Sign Out</h4>
              <p className="text-xs font-bold text-red-400 uppercase tracking-widest mt-2">End your session</p>
            </div>
          </div>
        )}
      </div>
    </TabletDashboardLayout>
  );

  return (
    <ResponsiveAppLayout 
      mobile={mobileView} 
      tablet={
        activeRole === 'nurse' ? (
          <NurseDesktopShell>
            {tabletView}
          </NurseDesktopShell>
        ) : tabletView
      } 
    />
  );
}

// Helper Card component for mobile fallback
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-[2rem] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}
