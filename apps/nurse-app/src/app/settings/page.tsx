'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, LogOut, Calendar, Loader2, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { useAuth } from '@/contexts/AuthContext';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { NurseDesktopShell } from '@/components/layout/NurseDesktopShell';
import { DoctorProfileSettings } from '@/components/profile/DoctorProfileSettings';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { activeRole, clinicalProfile, isLoading: identityLoading } = useActiveIdentity();
  const { data: dashData, loading: dashLoading } = useNurseDashboard(user?.clinicId);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('selectedDoctorId');
    if (stored) {
      setSelectedDoctorId(stored);
    } else if (dashData?.doctors?.length) {
      setSelectedDoctorId(dashData.doctors[0].id);
    }
  }, [dashData?.doctors]);

  const handleDoctorChange = (id: string) => {
    setSelectedDoctorId(id);
    localStorage.setItem('selectedDoctorId', id);
  };

  const currentDoctor = dashData?.doctors.find(d => d.id === selectedDoctorId);

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
            <RoleSwitcher />
          </div>

          {!isDoctor && activeRole === 'nurse' && dashData?.doctors && (
            <div className="mt-8 flex flex-col items-center justify-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex flex-col items-center justify-center gap-2 group cursor-pointer">
                    <div className="relative">
                      <Avatar className="h-20 w-20 border-4 border-white/20 shadow-2xl transition-transform group-hover:scale-105 active:scale-95">
                        <AvatarImage src={currentDoctor?.avatar} />
                        <AvatarFallback className="bg-slate-800 text-white"><User className="h-8 w-8" /></AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-lg border border-slate-100">
                        <ChevronDown className="h-3 w-3 text-slate-900" strokeWidth={3} />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-black tracking-tight">{currentDoctor ? `Dr. ${currentDoctor.name}` : 'Select Doctor'}</p>
                      <p className="text-xs font-bold opacity-60 uppercase tracking-widest">{currentDoctor?.department || 'N/A'}</p>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="rounded-[2rem] border-none shadow-2xl bg-white/95 backdrop-blur-xl p-2 min-w-[240px]">
                  <div className="px-4 py-3 border-b border-slate-100 mb-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Switch Doctor Context</p>
                  </div>
                  {dashData.doctors.map((doctor) => (
                    <DropdownMenuItem 
                      key={doctor.id} 
                      onSelect={() => handleDoctorChange(doctor.id)}
                      className={cn(
                        "rounded-xl py-3 px-4 mb-1 transition-all flex items-center gap-3",
                        selectedDoctorId === doctor.id ? "bg-slate-100" : "hover:bg-slate-50"
                      )}
                    >
                      <Avatar className="h-8 w-8 border border-slate-200">
                        <AvatarImage src={doctor.avatar} />
                        <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">Dr. {doctor.name}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-50">{doctor.department}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </header>

        <main className="flex-1 p-4 -mt-6 relative z-20">
          {isDoctor ? (
            <DoctorProfileSettings initialData={clinicalProfile} onLogout={handleLogout} />
          ) : (
            <div className="space-y-6">
              <Card className="rounded-[2.5rem] border-none shadow-premium overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <Link href={`/appointments/schedule?doctor=${selectedDoctorId}`}>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 transition-all cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-white shadow-sm group-hover:rotate-6 transition-transform">
                          <Calendar className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-emerald-900">Doctor Schedule</span>
                          <span className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest">Manage sessions & availability</span>
                        </div>
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
            <Link href={`/appointments/schedule?doctor=${selectedDoctorId}`}>
              <div className="group p-8 rounded-[2.5rem] bg-white border border-slate-50 shadow-premium transition-all duration-500 flex flex-col items-center text-center cursor-pointer hover:shadow-2xl hover:-translate-y-2 active:scale-[0.98]">
                <div className="p-6 rounded-[2rem] bg-emerald-50 text-emerald-600 transition-transform group-hover:rotate-6 mb-6">
                  <Calendar className="h-8 w-8" />
                </div>
                <h4 className="text-xl font-black text-slate-900 tracking-tight">Doctor Schedule</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Manage sessions & availability</p>
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
