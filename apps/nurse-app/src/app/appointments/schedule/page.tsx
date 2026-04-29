'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  Loader2, 
  User, 
  ShieldCheck,
  Calendar,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Doctor } from '@kloqo/shared';
import { NurseScheduleManager } from "@/components/appointments/NurseScheduleManager";
import { NurseDateOverrideManager } from "@/components/appointments/NurseDateOverrideManager";
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import ClinicHeader from '@/components/clinic/ClinicHeader';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { NurseDesktopShell } from '@/components/layout/NurseDesktopShell';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';

function ScheduleContent() {
  const { user, loading: authLoading } = useAuth();
  const { activeRole, clinicalProfile } = useActiveIdentity();
  const { data: dashboardContextData, loading: dashboardLoading } = useNurseDashboardContext();
  const { data: nurseDashData, updateDoctorStatus } = useNurseDashboard(user?.clinicId);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(
    searchParams.get('doctor') || (typeof window !== 'undefined' ? localStorage.getItem('selectedDoctorId') : null)
  );
  const [activeTab, setActiveTab] = useState('daily');

  const filteredDoctors = useMemo(() => {
    const docs = dashboardContextData?.doctors || nurseDashData?.doctors || [];
    if (activeRole === 'doctor' && clinicalProfile) {
      return docs.filter(d => d.id === clinicalProfile.id);
    }
    return docs;
  }, [dashboardContextData, nurseDashData, activeRole, clinicalProfile]);

  const selectedDoctor = useMemo(() => {
    return filteredDoctors.find(d => d.id === selectedDoctorId) || filteredDoctors[0];
  }, [filteredDoctors, selectedDoctorId]);

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
      <AppFrameLayout showBottomNav>
        <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-slate-50">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-slate-500 font-bold tracking-tight uppercase text-xs">Accessing Schedule Fleet...</p>
        </div>
      </AppFrameLayout>
    );
  }

  if (!user || !user.clinicId) return null;

  const handleDoctorChange = (id: string) => {
    setSelectedDoctorId(id);
    localStorage.setItem('selectedDoctorId', id);
    router.replace(`/appointments/schedule?doctor=${id}`);
  };

  const pageContent = (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-10 pb-20">
      {/* Header Section - Only visible on non-mobile */}
      <div className="hidden md:flex flex-col md:flex-row md:items-end justify-between gap-6">
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
      </div>

      {selectedDoctor ? (
        <div className="grid grid-cols-1 gap-6 md:gap-10">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6 md:space-y-8">
            <div className="bg-white p-1.5 md:p-2 rounded-2xl md:rounded-[2.5rem] shadow-premium border border-slate-100 flex overflow-x-auto scrollbar-hide">
              <TabsList className="bg-transparent h-auto p-0 gap-1 md:gap-2 flex-nowrap">
                <TabsTrigger value="daily" className="rounded-xl md:rounded-2xl px-4 md:px-8 py-3 md:py-4 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[9px] md:text-[10px] tracking-widest md:tracking-[0.2em] transition-all whitespace-nowrap">
                  Daily Breaks
                </TabsTrigger>
                <TabsTrigger value="overrides" className="rounded-xl md:rounded-2xl px-4 md:px-8 py-3 md:py-4 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[9px] md:text-[10px] tracking-widest md:tracking-[0.2em] transition-all whitespace-nowrap">
                  Overrides
                </TabsTrigger>
                <TabsTrigger value="weekly" className="rounded-xl md:rounded-2xl px-4 md:px-8 py-3 md:py-4 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[9px] md:text-[10px] tracking-widest md:tracking-[0.2em] transition-all whitespace-nowrap flex items-center gap-1.5">
                  Weekly <ShieldCheck className="w-3 h-3 hidden md:block" />
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
                  {/* 1. The structural Lock Info Panel */}
                  <div className="lg:col-span-4 space-y-6 md:space-y-8">
                     <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] md:rounded-[3rem] bg-white overflow-hidden p-6 md:p-10 border border-slate-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-[1.25rem] md:rounded-[1.5rem] bg-slate-50 border-2 border-slate-100 flex items-center justify-center shadow-lg shadow-black/5 mb-4 md:mb-6">
                          <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-amber-500" />
                        </div>
                        <div className="space-y-3 md:space-y-4">
                          <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-800 leading-none">Structural Lock</h3>
                          <p className="text-[9px] md:text-xs text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                            Protected Configuration
                          </p>
                          <p className="text-xs md:text-sm text-slate-500 font-bold leading-relaxed px-2 md:px-4">
                            Recurring weekly availability management is restricted to <span className="text-primary">Clinic Admins</span>.
                          </p>
                          
                          <div className="pt-6 md:pt-8 space-y-3 md:space-y-4 w-full">
                             <div className="h-px bg-slate-100 w-full" />
                             <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Tactical Actions</p>
                             <div className="flex flex-wrap gap-2 justify-center">
                               <Badge variant="secondary" className="rounded-lg md:rounded-xl px-3 md:px-4 py-1.5 md:py-2 bg-slate-100 text-slate-600 font-black text-[9px] md:text-[10px] uppercase tracking-widest border-none">Breaks</Badge>
                               <Badge variant="secondary" className="rounded-lg md:rounded-xl px-3 md:px-4 py-1.5 md:py-2 bg-slate-100 text-slate-600 font-black text-[9px] md:text-[10px] uppercase tracking-widest border-none">Overrides</Badge>
                             </div>
                          </div>
                        </div>
                     </Card>
                  </div>

                  {/* 2. Read-Only Availability Grid */}
                  <div className="lg:col-span-8">
                     {selectedDoctor.availabilitySlots && selectedDoctor.availabilitySlots.length > 0 ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                         {selectedDoctor.availabilitySlots.map((slot) => (
                           <div key={slot.day} className="p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] bg-white border border-slate-100 shadow-premium relative overflow-hidden group hover:border-primary/20 transition-all duration-500">
                             <div className="absolute top-0 right-0 w-1.5 md:w-2 h-full bg-slate-50 group-hover:bg-primary/5 transition-colors" />
                             <div className="flex items-center gap-3 mb-4 md:mb-6">
                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                  <Calendar className="w-4 h-4 md:w-5 h-5" />
                                </div>
                                <h4 className="font-black text-xs md:text-sm text-slate-800 uppercase tracking-widest">{slot.day}</h4>
                             </div>
                             <div className="space-y-2 md:space-y-3">
                                {slot.timeSlots.map((ts, i: number) => (
                                  <div key={i} className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs font-black text-slate-600 bg-slate-50 py-2 md:py-3 px-3 md:px-4 rounded-xl md:rounded-2xl border border-slate-100/50">
                                    <Clock className="h-3.5 w-3.5 md:h-4 w-4 text-primary/40" />
                                    <span>{ts.from} – {ts.to}</span>
                                  </div>
                                ))}
                             </div>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="h-full min-h-[300px] md:min-h-[400px] flex flex-col items-center justify-center bg-slate-50 rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-slate-100 p-8">
                         <Clock className="w-12 h-12 md:w-16 md:h-16 text-slate-200 mb-4" />
                         <p className="font-black text-slate-400 uppercase tracking-widest text-[10px] md:text-xs">No configuration broadcasted</p>
                       </div>
                     )}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 md:py-40 space-y-4">
          <User className="w-12 h-12 md:w-16 md:h-16 text-slate-200" />
          <p className="font-bold text-slate-400 uppercase tracking-widest text-xs md:text-sm">No practitioners assigned to your profile</p>
        </div>
      )}
    </div>
  );

  const mobileView = (
    <AppFrameLayout showBottomNav>
      <div className="flex flex-col min-h-screen bg-slate-50 font-pt-sans w-full max-w-md mx-auto">
        <ClinicHeader 
          doctors={filteredDoctors as Doctor[]}
          selectedDoctor={selectedDoctorId || ''}
          onDoctorChange={handleDoctorChange}
          showLogo={false}
          pageTitle="Schedule Ops"
          showSettings={false}
        />
        <main className="flex-1 p-4 -mt-6 z-10 bg-slate-50 rounded-t-3xl pb-24">
          {pageContent}
        </main>
      </div>
    </AppFrameLayout>
  );

  const tabletView = (
    <TabletDashboardLayout hideSidebar={activeRole === 'nurse'}>
      <div className="p-8">
        {pageContent}
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

export default function ScheduleManagementPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <ScheduleContent />
    </Suspense>
  );
}
