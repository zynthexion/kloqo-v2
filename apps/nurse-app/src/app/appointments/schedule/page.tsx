'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  Loader2, 
  User, 
  ShieldCheck,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Doctor } from '@kloqo/shared';
import { NurseScheduleManager } from "@/components/appointments/NurseScheduleManager";
import { NurseDateOverrideManager } from "@/components/appointments/NurseDateOverrideManager";

function ScheduleContent() {
  const { user, loading: authLoading } = useAuth();
  const { data, loading: dashboardLoading } = useNurseDashboardContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(
    searchParams.get('doctor') || (typeof window !== 'undefined' ? localStorage.getItem('selectedDoctorId') : null)
  );
  const [activeTab, setActiveTab] = useState('daily');

  const selectedDoctor = useMemo(() => {
    return data?.doctors.find(d => d.id === selectedDoctorId) || data?.doctors[0];
  }, [data, selectedDoctorId]);

  useEffect(() => {
    if (selectedDoctor && selectedDoctor.id !== selectedDoctorId) {
      setSelectedDoctorId(selectedDoctor.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedDoctorId', selectedDoctor.id);
      }
    }
  }, [selectedDoctor, selectedDoctorId]);

  if (authLoading || (user && dashboardLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-slate-500 font-bold tracking-tight uppercase text-xs">Accessing Schedule Fleet...</p>
      </div>
    );
  }

  if (!user || !user.clinicId) return null;

  return (
    <TabletDashboardLayout>
      <div className="max-w-6xl mx-auto space-y-10 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black uppercase tracking-widest text-[10px] px-3 py-1">
                Clinical Operations
              </Badge>
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 font-black uppercase tracking-widest text-[10px] px-3 py-1">
                Tactical RBAC Active
              </Badge>
            </div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none">Schedule<span className="text-primary">.</span></h1>
            <p className="text-slate-500 font-bold max-w-md leading-relaxed">
              Manage clinical pauses, session extensions, and daily overrides for authorized practitioners.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white p-2 rounded-[2rem] shadow-xl shadow-black/5 border border-slate-100 overflow-x-auto no-scrollbar max-w-full">
             {data?.doctors.map(doc => (
               <button
                 key={doc.id}
                 onClick={() => setSelectedDoctorId(doc.id)}
                 className={cn(
                   "flex items-center gap-3 px-6 py-3 rounded-2xl transition-all duration-300 shrink-0",
                   selectedDoctorId === doc.id 
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-105" 
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                 )}
               >
                 <div className={cn(
                   "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs",
                   selectedDoctorId === doc.id ? "bg-white/20" : "bg-slate-100"
                 )}>
                   {doc.name?.[0]}
                 </div>
                 <span className="font-black text-xs uppercase tracking-widest">
                   Dr. {doc.name?.split(' ')[0]}
                 </span>
               </button>
             ))}
          </div>
        </div>

        {selectedDoctor ? (
          <div className="grid grid-cols-1 gap-10">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
              <div className="bg-white p-2 rounded-[2.5rem] shadow-premium border border-slate-100 inline-flex">
                <TabsList className="bg-transparent h-auto p-0 gap-2">
                  <TabsTrigger value="daily" className="rounded-2xl px-8 py-4 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-[0.2em] transition-all">
                    Daily Breaks
                  </TabsTrigger>
                  <TabsTrigger value="overrides" className="rounded-2xl px-8 py-4 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-[0.2em] transition-all">
                    Overrides
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className="rounded-2xl px-8 py-4 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center gap-2">
                    Weekly Profile <ShieldCheck className="w-3 h-3" />
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-700">
                <TabsContent value="daily" className="mt-0 focus-visible:outline-none">
                  <NurseScheduleManager doctor={selectedDoctor} clinicId={user.clinicId} />
                </TabsContent>

                <TabsContent value="overrides" className="mt-0 focus-visible:outline-none">
                  <NurseDateOverrideManager doctor={selectedDoctor} clinicId={user.clinicId} />
                </TabsContent>

                <TabsContent value="weekly" className="mt-0 focus-visible:outline-none">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* 1. The structural Lock Info Panel */}
                    <div className="lg:col-span-4 space-y-8">
                       <Card className="border-none shadow-2xl shadow-black/5 rounded-[3rem] bg-white overflow-hidden p-10 border border-slate-100 flex flex-col items-center text-center">
                          <div className="w-20 h-20 rounded-[1.5rem] bg-slate-50 border-2 border-slate-100 flex items-center justify-center shadow-lg shadow-black/5 mb-6">
                            <ShieldCheck className="w-10 h-10 text-amber-500" />
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800 leading-none">Structural Lock</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                              Protected Configuration
                            </p>
                            <p className="text-sm text-slate-500 font-bold leading-relaxed px-4">
                              Recurring weekly availability management is restricted to <span className="text-primary">Clinic Admins</span>.
                            </p>
                            
                            <div className="pt-8 space-y-4 w-full">
                               <div className="h-px bg-slate-100 w-full" />
                               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Tactical Actions</p>
                               <div className="flex flex-wrap gap-2 justify-center">
                                 <Badge variant="secondary" className="rounded-xl px-4 py-2 bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest border-none">Breaks</Badge>
                                 <Badge variant="secondary" className="rounded-xl px-4 py-2 bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest border-none">Overrides</Badge>
                               </div>
                            </div>
                          </div>
                       </Card>
                    </div>

                    {/* 2. Read-Only Availability Grid */}
                    <div className="lg:col-span-8">
                       {selectedDoctor.availabilitySlots && selectedDoctor.availabilitySlots.length > 0 ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {selectedDoctor.availabilitySlots.map(slot => (
                             <div key={slot.day} className="p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-premium relative overflow-hidden group hover:border-primary/20 transition-all duration-500">
                               <div className="absolute top-0 right-0 w-2 h-full bg-slate-50 group-hover:bg-primary/5 transition-colors" />
                               <div className="flex items-center gap-3 mb-6">
                                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                    <Calendar className="w-5 h-5" />
                                  </div>
                                  <h4 className="font-black text-sm text-slate-800 uppercase tracking-widest">{slot.day}</h4>
                               </div>
                               <div className="space-y-3">
                                  {slot.timeSlots.map((ts, i) => (
                                    <div key={i} className="flex items-center gap-3 text-xs font-black text-slate-600 bg-slate-50 py-3 px-4 rounded-2xl border border-slate-100/50">
                                      <Clock className="h-4 w-4 text-primary/40" />
                                      <span>{ts.from} – {ts.to}</span>
                                    </div>
                                  ))}
                               </div>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-100">
                           <Clock className="w-16 h-16 text-slate-200 mb-4" />
                           <p className="font-black text-slate-400 uppercase tracking-widest text-xs">No configuration broadcasted</p>
                         </div>
                       )}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-40 space-y-4">
            <User className="w-16 h-16 text-slate-200" />
            <p className="font-bold text-slate-400 uppercase tracking-widest text-sm">No practitioners assigned to your profile</p>
          </div>
        )}
      </div>
    </TabletDashboardLayout>
  );
}

export default function ScheduleManagementPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <ScheduleContent />
    </Suspense>
  );
}
