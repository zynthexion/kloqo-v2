'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, CalendarCheck, Clock, Star, Trophy, ArrowUpRight } from "lucide-react";
import PatientsVsAppointmentsChart from "@/components/dashboard/patients-vs-appointments-chart";
import AppointmentStatusChart from "@/components/dashboard/appointment-status-chart";
import OverviewStats from "@/components/dashboard/overview-stats";
import type { Doctor, Appointment } from '@kloqo/shared';

interface StatsTabProps {
  doctor: Doctor;
  appointments: Appointment[];
  dateRange: any;
  onRangeChange: (range: any) => void;
}

export function StatsTab({ doctor, appointments, dateRange }: StatsTabProps) {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { icon: Users, label: "Total Patients", val: appointments.length, color: "bg-blue-500" },
          { icon: Trophy, label: "Success Rate", val: "94%", color: "bg-emerald-500" },
          { icon: Star, label: "Patient Rating", val: "4.9", color: "bg-amber-500" },
          { icon: TrendingUp, label: "Growth", val: "+12%", color: "bg-indigo-500" }
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-2xl shadow-black/5 rounded-[2.5rem] bg-white overflow-hidden p-8 relative group active:scale-95 transition-all">
             <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-slate-50 rounded-full blur-3xl group-hover:bg-slate-100 transition-colors" />
             <div className="relative">
               <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center mb-6 shadow-xl", stat.color.replace('bg-', 'shadow-').concat('/20'), stat.color)}>
                 <stat.icon className="h-7 w-7 text-white" />
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{stat.label}</p>
               <div className="flex items-end gap-3">
                 <h4 className="text-3xl font-black text-slate-800 tracking-tighter leading-none">{stat.val}</h4>
                 <ArrowUpRight className="h-5 w-5 text-emerald-500 mb-1" />
               </div>
             </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <Card className="lg:col-span-8 border-none shadow-2xl shadow-black/5 rounded-[3rem] bg-white overflow-hidden">
          <CardHeader className="p-10 border-b border-slate-50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-indigo-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Clinic Throughput</CardTitle>
                <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Consultation volume analysis trends </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="px-4 py-2 rounded-xl bg-slate-50 text-slate-400 border-none font-black text-[10px] uppercase tracking-widest">Last 30 Days</Badge>
          </CardHeader>
          <CardContent className="p-10">
            <div className="h-[400px]">
              <PatientsVsAppointmentsChart />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-2xl shadow-black/5 rounded-[3rem] bg-white overflow-hidden">
          <CardHeader className="p-10 border-b border-slate-50">
             <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Star className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Status Mix</CardTitle>
                <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Distribution of appointment outcomes </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10">
             <div className="h-[400px]">
              <AppointmentStatusChart data={[]} loading={false} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-12 rounded-[4rem] bg-slate-900 shadow-2xl shadow-black/20 text-white relative overflow-hidden group">
         <div className="absolute top-[-50%] right-[-10%] w-[600px] h-[600px] bg-theme-blue/20 rounded-full blur-[120px]" />
         <div className="relative grid grid-cols-1 lg:grid-cols-12 items-center gap-12">
            <div className="lg:col-span-8 space-y-6">
               <h3 className="text-4xl font-black tracking-tighter leading-tight">Precision Clinical Insights</h3>
               <p className="text-lg font-bold text-slate-400 leading-relaxed max-w-2xl">
                 Real-time analytics engine processing clinical data to optimize session throughput and patient satisfaction metrics. Automated reporting available for seasonal trend identification.
               </p>
               <div className="flex gap-4 pt-4">
                  <div className="px-6 py-4 bg-white/5 backdrop-blur-3xl rounded-3xl border border-white/10">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-2">Confidence Level</p>
                     <p className="text-xl font-black text-emerald-400 uppercase tracking-tight leading-none">High Probability</p>
                  </div>
                   <div className="px-6 py-4 bg-white/5 backdrop-blur-3xl rounded-3xl border border-white/10">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-2">Optimized For</p>
                     <p className="text-xl font-black text-theme-blue uppercase tracking-tight leading-none">Growth Metrics</p>
                  </div>
               </div>
            </div>
            <div className="lg:col-span-4 flex justify-center">
               <div className="h-56 w-56 rounded-full border-[1.5rem] border-theme-blue/20 border-t-theme-blue animate-[spin_10s_linear_infinite] flex items-center justify-center">
                  <div className="h-32 w-32 rounded-full border-[1rem] border-white/10 border-r-emerald-500/50 flex items-center justify-center animate-[spin_5s_linear_infinite_reverse]">
                     <TrendingUp className="h-8 w-8 text-white/20" />
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

// Utility for cn (Tailwind merge)
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
