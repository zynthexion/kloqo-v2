'use client';

import React from 'react';
import { 
  Users, 
  CheckCircle2, 
  Calendar, 
  XCircle, 
  IndianRupee, 
  TrendingUp, 
  ArrowUpRight, 
  Activity, 
  ChevronRight 
} from 'lucide-react';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { StatCard, AppointmentOverviewChart, AnalyticsOverviewChart } from '@/components/analytics/AnalyticsCards';
import { cn } from '@/lib/utils';
import { DateRangeType } from '@/hooks/useAnalytics';

interface TabletDashboardViewProps {
  displayName: string;
  range: DateRangeType;
  setRange: (range: DateRangeType) => void;
  analytics: any;
  analyticsLoading: boolean;
  mainMenuItems: any[];
}

export function TabletDashboardView({
  displayName,
  range,
  setRange,
  analytics,
  analyticsLoading,
  mainMenuItems
}: TabletDashboardViewProps) {
  return (
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

        {/* Menu Grid */}
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
}
