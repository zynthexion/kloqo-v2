'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, UserPlus, Coffee, BarChart3, Loader2, TrendingUp, Clock, Users, Zap, ChevronRight, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import ClinicHeader from '@/components/clinic/ClinicHeader';
import { cn } from '@/lib/utils';
import { Doctor } from '@kloqo/shared';
import { useTheme } from '@/contexts/ThemeContext';
import DailyProgress from '@/components/clinic/DailyProgress';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { StatCard, EfficiencyGauge, VolumeChart } from '@/components/analytics/AnalyticsCards';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');

  const clinicId = user?.clinicId;
  const { data, loading: dashLoading, updateDoctorStatus } = useNurseDashboard(clinicId);

  // Auth guard and role-based mobile redirect
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }

    // If doctor is on mobile, redirect to day-snapshot as default home
    if (user && !authLoading) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const activeRole = localStorage.getItem('activeRole') || user.role;
      if (isMobile && activeRole === 'doctor') {
        router.replace('/day-snapshot');
      }
    }
  }, [user, authLoading, router]);

  // Auto-select first doctor
  useEffect(() => {
    if (data?.doctors?.length && !selectedDoctor) {
      const stored = localStorage.getItem('selectedDoctorId');
      const found = data.doctors.find(d => d.id === stored);
      setSelectedDoctor(found ? found.id : data.doctors[0].id);
    }
  }, [data?.doctors, selectedDoctor]);

  const handleDoctorChange = (id: string) => {
    setSelectedDoctor(id);
    localStorage.setItem('selectedDoctorId', id);
  };

  const currentDoctor = data?.doctors.find(d => d.id === selectedDoctor);
  const consultationStatus = (currentDoctor?.consultationStatus ?? 'Out') as 'In' | 'Out';

  const handleStatusChange = async (newStatus: 'In' | 'Out', sessionIndex?: number) => {
    if (!currentDoctor) return;
    try {
      await updateDoctorStatus(currentDoctor.id, newStatus, sessionIndex);
    } catch (e) {
      console.error(e);
    }
  };

  const { theme } = useTheme();
  const isModern = theme === 'modern';

  if (authLoading || (user && dashLoading)) {
    return (
      <AppFrameLayout>
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-theme-blue" />
        </div>
      </AppFrameLayout>
    );
  }

  if (!user) return null;

  const mainMenuItems = [
    {
      icon: Phone,
      title: 'Phone Booking',
      subtitle: 'Manage phone appointments',
      action: () => selectedDoctor && router.push(`/phone-booking/details?doctor=${selectedDoctor}`),
      disabled: !selectedDoctor,
      colors: isModern ? 'bg-gradient-to-br from-[#F5470D] to-[#fc7144] text-white' : 'bg-gradient-to-br from-[#429EBD] to-[#52b1d3] text-white',
      iconContainer: 'bg-white/20',
    },
    {
      icon: UserPlus,
      title: 'Walk-in',
      subtitle: selectedDoctor ? 'Register a new walk-in patient' : 'Select a doctor first',
      action: () => selectedDoctor && router.push(`/walk-in?doctor=${selectedDoctor}`),
      disabled: !selectedDoctor,
      colors: isModern ? 'bg-gradient-to-br from-[#232230] to-[#3a394a] text-white' : 'bg-gradient-to-br from-[#FFBA08] to-[#ffd46a] text-black',
      iconContainer: 'bg-white/20',
    },
  ];

  const mobileView = (
    <AppFrameLayout showBottomNav>
      <div className={cn("relative flex flex-col h-full transition-all duration-500", !isModern && "bg-muted/20")}>
        <ClinicHeader
          doctors={(data?.doctors ?? []) as Doctor[]}
          selectedDoctor={selectedDoctor}
          onDoctorChange={handleDoctorChange}
          showLogo={true}
          consultationStatus={consultationStatus}
          onStatusChange={handleStatusChange}
          hasActiveAppointments={
            (data?.appointments ?? []).some(a =>
              ['Pending', 'Confirmed', 'Skipped'].includes(a.status)
            )
          }
        />

        {isModern && selectedDoctor && (
          <DailyProgress 
            appointments={(data?.appointments ?? []).filter(a => a.doctorId === selectedDoctor)} 
            className="animate-in fade-in slide-in-from-top-4 duration-700"
          />
        )}

        <main className={cn(
          "relative flex-1 flex flex-col p-6 z-10 transition-all duration-500",
          isModern ? "-mt-8" : "-mt-12 bg-gradient-to-b from-transparent to-[rgba(37,108,173,0.3)]"
        )}>
          <div className="flex flex-col flex-1 justify-center mx-auto w-full max-w-2xl px-4">
            <div className="relative flex-1 flex flex-col justify-center items-center gap-8 py-12">
              {mainMenuItems.map((item, index) => (
                <div
                  key={index}
                  onClick={item.disabled ? undefined : item.action}
                  className={cn(
                    "transition-all duration-500 ease-in-out flex flex-col items-center justify-center text-center p-8",
                    isModern 
                      ? "w-full min-h-[160px] rounded-[3rem] shadow-premium bg-white/70 backdrop-blur-md border border-white/50 flex-row justify-start text-left" 
                      : "w-full max-w-lg min-h-[180px] rounded-[2.5rem] shadow-premium bg-white border border-slate-100 flex-row justify-start text-left px-10",
                    item.disabled
                      ? 'opacity-60 cursor-not-allowed bg-slate-100/50'
                      : 'cursor-pointer hover:shadow-2xl hover:-translate-y-2 active:scale-[0.98]',
                    !isModern && item.colors
                  )}
                >
                  <div className={cn(
                    "rounded-[1.5rem] p-5 transition-all duration-500 shadow-lg", 
                    isModern ? item.colors + " shadow-primary/25 mr-6" : item.iconContainer + " mr-6"
                  )}>
                    <item.icon className={cn("h-10 w-10 text-white")} />
                  </div>
                  <div className="flex-1 flex flex-col items-start text-left">
                    <h2 className={cn(
                      "font-black leading-tight tracking-tight", 
                      isModern ? "text-slate-900 text-2xl" : "text-white text-2xl"
                    )}>
                      {item.title}
                    </h2>
                    <p className={cn(
                      "text-sm mt-1.5 font-medium", 
                      isModern ? "text-slate-500" : "text-white/80"
                    )}>
                      {item.subtitle}
                    </p>
                  </div>
                </div>
              ))}

              {/* Stats/Break Row for Modern Theme */}
              {isModern && selectedDoctor && (
                <div className="w-full flex justify-between gap-4 mt-4 px-2">
                  <button onClick={() => router.push('/day-snapshot')} className="flex-1 group">
                    <div className="relative w-full aspect-square flex flex-col items-center justify-center transition-all duration-500 bg-slate-50/50 backdrop-blur-md rounded-[2.5rem] border border-white hover:bg-white hover:shadow-premium">
                      <BarChart3 className="h-8 w-8 text-primary transition-all duration-300 group-hover:scale-110" strokeWidth={2.5} />
                      <span className="text-[10px] font-black uppercase tracking-widest mt-2 text-muted-foreground">Stats</span>
                    </div>
                  </button>
                  <button onClick={() => selectedDoctor && router.push(`/schedule-break?doctor=${selectedDoctor}`)} className="flex-1 group">
                    <div className="relative w-full aspect-square flex flex-col items-center justify-center transition-all duration-500 bg-amber-50/50 backdrop-blur-md rounded-[2.5rem] border border-white hover:bg-white hover:shadow-premium">
                      <Coffee className="h-8 w-8 text-amber-500 transition-all duration-300 group-hover:scale-110" strokeWidth={2.5} />
                      <span className="text-[10px] font-black uppercase tracking-widest mt-2 text-muted-foreground">Break</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </AppFrameLayout>
  );

  const { displayName } = useActiveIdentity();

  const tabletView = (
    <TabletDashboardLayout>
      <div className="space-y-12 py-8 animate-in fade-in duration-700">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Overview</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Welcome Back, {displayName}</p>
          </div>
          <div className="flex gap-4">
             <Button className="h-14 px-8 rounded-2xl shadow-lg shadow-primary/20 bg-primary font-black uppercase tracking-widest text-xs hover:scale-105 transition-all">
                <Zap className="mr-2 h-4 w-4" />
                Quick Action
             </Button>
          </div>
        </header>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <StatCard 
            title="Total Patients" 
            value="1,240" 
            subtitle="Patients seen this month" 
            trend={{ value: "12%", isUp: true }}
            icon={Users}
            color="bg-primary shadow-lg shadow-primary/20"
          />
          <StatCard 
            title="Avg. Wait Time" 
            value="14 min" 
            subtitle="Minutes per patient" 
            trend={{ value: "5%", isUp: false }}
            icon={Clock}
            color="bg-purple-600 shadow-lg shadow-purple-600/20"
          />
          <StatCard 
            title="Todays Revenue" 
            value="₹4,500" 
            subtitle="Estimated earnings today" 
            trend={{ value: "8%", isUp: true }}
            icon={TrendingUp}
            color="bg-pink-600 shadow-lg shadow-pink-600/20"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <VolumeChart data={[450, 590, 800, 810, 560, 400]} />
           <EfficiencyGauge percentage={78} label="Consultation Ratio" />
        </div>

        {/* Menu Grid - Redesigned for modern feel */}
        <div className="space-y-6">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest px-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Clinic Modules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mainMenuItems.map((item, index) => (
                    <div
                        key={index}
                        onClick={item.disabled ? undefined : item.action}
                        className={cn(
                            "group p-6 rounded-[2rem] bg-white border border-slate-50 shadow-premium transition-all duration-500 flex items-center gap-6",
                            item.disabled ? "opacity-50 grayscale" : "cursor-pointer hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98]"
                        )}
                    >
                        <div className={cn("p-4 rounded-2xl text-white transition-transform group-hover:rotate-6", item.colors)}>
                            <item.icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-black text-slate-900 tracking-tight">{item.title}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.subtitle}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                ))}
            </div>
        </div>
      </div>
    </TabletDashboardLayout>
  );

  return (
    <ResponsiveAppLayout 
      mobile={mobileView} 
      tablet={tabletView} 
    />
  );
}
