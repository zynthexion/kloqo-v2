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
import { StatCard, EfficiencyGauge, VolumeChart, AppointmentOverviewChart, AnalyticsOverviewChart } from '@/components/analytics/AnalyticsCards';
import { Button } from '@/components/ui/button';
import { useAnalytics, DateRangeType } from '@/hooks/useAnalytics';
import { IndianRupee, Calendar, XCircle, CheckCircle2, ArrowUpRight } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');

  const clinicId = user?.clinicId;
  const { data: dashData, loading: dashLoading, updateDoctorStatus } = useNurseDashboard(clinicId);
  const { data: analytics, loading: analyticsLoading, range, setRange } = useAnalytics(selectedDoctor);

  const isInitialLoading = authLoading || (user && dashLoading && !dashData);

  useEffect(() => {
    if (analytics) {
      console.log('📊 [Analytics Data Updated]:', analytics);
    }
  }, [analytics]);

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
    if (dashData?.doctors?.length && !selectedDoctor) {
      const stored = localStorage.getItem('selectedDoctorId');
      const found = dashData.doctors.find(d => d.id === stored);
      setSelectedDoctor(found ? found.id : dashData.doctors[0].id);
    }
  }, [dashData?.doctors, selectedDoctor]);

  const handleDoctorChange = (id: string) => {
    setSelectedDoctor(id);
    localStorage.setItem('selectedDoctorId', id);
  };

  const currentDoctor = dashData?.doctors.find(d => d.id === selectedDoctor);
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

  if (isInitialLoading) {
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
          doctors={(dashData?.doctors ?? []) as Doctor[]}
          selectedDoctor={selectedDoctor}
          onDoctorChange={handleDoctorChange}
          showLogo={true}
          consultationStatus={consultationStatus}
          onStatusChange={handleStatusChange}
          hasActiveAppointments={
            (dashData?.appointments ?? []).some(a =>
              ['Pending', 'Confirmed', 'Skipped'].includes(a.status)
            )
          }
        />

        {isModern && selectedDoctor && (
          <DailyProgress 
            appointments={(dashData?.appointments ?? []).filter(a => a.doctorId === selectedDoctor)} 
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
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Overview</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">Welcome Back, {displayName}</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner">
                {(['today', '7days', 'monthly', 'yearly'] as DateRangeType[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      range === r 
                        ? "bg-white text-primary shadow-sm" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {r === '7days' ? '7 Days' : r}
                  </button>
                ))}
             </div>
             <Button className="h-14 px-8 rounded-2xl shadow-lg shadow-primary/20 bg-primary font-black uppercase tracking-widest text-xs hover:scale-105 transition-all">
                <Zap className="mr-2 h-4 w-4" />
                Quick Action
             </Button>
          </div>
        </header>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <StatCard 
            title="Total Patients" 
            value={analytics?.current.totalPatients || 0} 
            subtitle={`Unique patients in ${range}`} 
            trend={{ value: analytics?.comparison.patientsChange || "0%", isUp: !analytics?.comparison.patientsChange.startsWith('-') }}
            icon={Users}
            color="bg-primary shadow-lg shadow-primary/20"
          />
          <StatCard 
            title="Completed" 
            value={analytics?.current.completedAppointments || 0} 
            subtitle="Successful consultations" 
            trend={{ value: analytics?.comparison.appointmentsChange || "0%", isUp: !analytics?.comparison.appointmentsChange.startsWith('-') }}
            icon={CheckCircle2}
            color="bg-emerald-600 shadow-lg shadow-emerald-600/20"
          />
          <StatCard 
            title="Upcoming" 
            value={analytics?.current.upcomingAppointments || 0} 
            subtitle="Scheduled consultations" 
            icon={Calendar}
            color="bg-amber-500 shadow-lg shadow-amber-500/20"
          />
          <StatCard 
            title="Cancelled" 
            value={analytics?.current.cancelledAppointments || 0} 
            subtitle="Appointment drop-offs" 
            trend={{ value: analytics?.comparison.cancelledChange || "0%", isUp: false }}
            icon={XCircle}
            color="bg-rose-500 shadow-lg shadow-rose-500/20"
          />
        </div>

        {/* Revenue Highlight */}
        <div className="p-10 rounded-[3rem] bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                <IndianRupee className="h-40 w-40" />
            </div>
            <div className="relative z-10 flex justify-between items-center">
                <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Total Revenue Generated</p>
                    <div className="flex items-center gap-4">
                        <div className="p-4 rounded-3xl bg-white/10 backdrop-blur-md">
                            <TrendingUp className="h-8 w-8 text-emerald-400" />
                        </div>
                        <h2 className="text-6xl font-black tracking-tighter">
                            <span className="text-slate-500 mr-2">₹</span>
                            {analytics?.current.totalRevenue.toLocaleString() || 0}
                        </h2>
                    </div>
                </div>
                <div className="text-right">
                    <div className={cn(
                        "inline-flex items-center gap-2 px-6 py-3 rounded-full text-lg font-black",
                        analytics?.comparison.revenueChange.startsWith('-') ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                    )}>
                        {analytics?.comparison.revenueChange || "0%"}
                        <ArrowUpRight className={cn("h-5 w-5", analytics?.comparison.revenueChange.startsWith('-') && "rotate-90")} />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4">vs last period</p>
                </div>
            </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
           <AnalyticsOverviewChart data={analytics} loading={analyticsLoading} />
           <AppointmentOverviewChart data={analytics} loading={analyticsLoading} />
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
