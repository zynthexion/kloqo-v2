
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, WifiOff, TrendingUp, Clock } from 'lucide-react';
import ClinicHeader from './ClinicHeader';
import AppointmentList from './AppointmentList';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';

type LiveDashboardProps = {
  clinicId: string;
};

export default function LiveDashboard({ clinicId }: LiveDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, loading, error, updateDoctorStatus, updateAppointmentStatus, selectedDoctorId, setSelectedDoctorId } = useNurseDashboard(clinicId);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('arrived');
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data?.doctors.length && !selectedDoctorId) {
      const initialId = searchParams.get('doctor') || data.doctors[0].id;
      setSelectedDoctorId(initialId);
      if (!searchParams.get('doctor')) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('doctor', initialId);
        router.replace(`?${params.toString()}`);
      }
    }
  }, [data, selectedDoctorId, searchParams, router]);

  const handleDoctorChange = (id: string) => {
    setSelectedDoctorId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('doctor', id);
    router.replace(`?${params.toString()}`);
  };

  const currentDoctor = useMemo(() => 
    data?.doctors.find(d => d.id === selectedDoctorId), 
    [data, selectedDoctorId]
  );

  const queueState = useMemo(() => {
    if (!selectedDoctorId || !data?.queues) return null;
    return data.queues[selectedDoctorId];
  }, [data, selectedDoctorId]);

  const filteredAppointments = useMemo(() => {
    if (!data?.appointments) return [];
    let filtered = data.appointments.filter(a => a.doctorId === selectedDoctorId);
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.patientName.toLowerCase().includes(lowerSearch) || 
        a.tokenNumber.toLowerCase().includes(lowerSearch) ||
        a.communicationPhone?.toLowerCase().includes(lowerSearch) ||
        (a as any).phone?.toLowerCase().includes(lowerSearch)
      );
    }
    return filtered;
  }, [data, selectedDoctorId, searchTerm]);

  const arrivedAppointments = useMemo(() => 
    filteredAppointments.filter(a => a.status === 'Confirmed'),
    [filteredAppointments]
  );

  const pendingAppointments = useMemo(() => 
    filteredAppointments.filter(a => a.status === 'Pending'),
    [filteredAppointments]
  );

  const skippedAppointments = useMemo(() => 
    filteredAppointments.filter(a => ['Skipped', 'No-show'].includes(a.status)),
    [filteredAppointments]
  );

  const handleStatusChange = async (newStatus: 'In' | 'Out') => {
    if (!selectedDoctorId) return;
    try {
      await updateDoctorStatus(selectedDoctorId, newStatus);
      toast({
        title: `Doctor marked ${newStatus}`,
        duration: 2000,
      });
    } catch (err) {
      toast({
        title: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleUpdateAppointmentStatus = async (id: string, status: string) => {
    try {
      await updateAppointmentStatus(id, status);
      toast({
        title: `Appointment ${status}`,
        duration: 2000,
      });
    } catch (err) {
      toast({
        title: "Failed to update appointment",
        variant: "destructive",
      });
    }
  };

  const { theme } = useTheme();

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <WifiOff className="h-12 w-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-bold text-slate-800">Connection Error</h3>
        <p className="text-sm text-slate-500 max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 flex flex-col min-h-0 bg-slate-50", theme === 'modern' && "bg-transparent")}>
      <ClinicHeader
        doctors={data?.doctors || []}
        selectedDoctor={selectedDoctorId || ''}
        onDoctorChange={handleDoctorChange}
        consultationStatus={currentDoctor?.consultationStatus as 'In' | 'Out'}
        onStatusChange={handleStatusChange}
        currentTime={currentTime}
      />

      <div className={cn("px-4 py-3 sticky top-0 z-20 transition-all duration-500", theme === 'modern' ? "bg-transparent mx-2" : "bg-white border-b border-slate-100")}>
        <div className={cn("relative", theme === 'modern' && "modern-glass-card p-2 shadow-premium")}>
          <Search className={cn("absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400", theme === 'modern' && "text-primary left-6")} />
          <Input
            placeholder="Search patient or token..."
            className={cn(
              "pl-10 h-11 bg-slate-50 border-none transition-all duration-300", 
              theme === 'modern' ? "bg-white/50 rounded-2xl focus-visible:ring-primary/30 pl-12" : "focus-visible:ring-theme-blue"
            )}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* 📊 DYNAMIC SESSION HEALTH & GOALS */}
        {theme === 'modern' && selectedDoctorId && data?.doctorAnalytics?.[selectedDoctorId] && (
          <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
            {(() => {
              const currentAnalytics = data.doctorAnalytics[selectedDoctorId];
              return (
                <>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Session Health</span>
                  
                  {/* Wait Time Trend Card */}
                  <div className="border shadow-sm rounded-[2.5rem] border-none shadow-premium bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white relative overflow-hidden group">
                    <TrendingUp className="absolute top-[-10%] right-[-5%] w-32 h-32 opacity-10 rotate-12 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-0" />
                    <div className="relative z-10">
                      <p className="text-white/70 text-xs font-black uppercase tracking-widest">Wait Time Trend</p>
                      <h3 className="text-4xl font-black mt-2">~{currentAnalytics.waitTimeTrend}m</h3>
                      <div className="flex items-center gap-2 mt-4 bg-white/20 w-fit px-3 py-1 rounded-full text-[10px] font-bold">
                        <Clock className="h-3 w-3" />
                        {currentAnalytics.waitTimeTrend < 20 ? 'STABLE CONTEXT' : 'HIGH DEMAND'}
                      </div>
                    </div>
                  </div>

                  {/* Today's Goal Card */}
                  <div className="border text-card-foreground shadow-sm rounded-[2.5rem] border-none shadow-premium bg-white/60 backdrop-blur-md p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-slate-900 font-black text-sm uppercase tracking-tight">Today's Goal</p>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-black",
                        currentAnalytics.todayGoalPercentage > 70 ? "bg-emerald-100 text-emerald-700" : "bg-theme-blue/10 text-theme-blue"
                      )}>
                        {currentAnalytics.todayGoalPercentage}% DONE
                      </span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-xs text-slate-600 font-medium flex-1">Completed Appointments</span>
                        <span className="text-xs font-black text-slate-900">{currentAnalytics.completedCount}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="text-xs text-slate-600 font-medium flex-1">Upcoming Visits</span>
                        <span className="text-xs font-black text-slate-900">{currentAnalytics.upcomingCount}</span>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className={cn("px-4 pt-4 bg-white", theme === 'modern' && "bg-transparent")}>
          <TabsList className={cn("w-full grid grid-cols-3 h-12 p-1 bg-slate-100 rounded-xl", theme === 'modern' && "bg-muted/30 border border-white/20 h-14 rounded-2xl")}>
            <TabsTrigger 
              value="arrived" 
              className={cn(
                "rounded-lg data-[state=active]:bg-white data-[state=active]:text-theme-blue data-[state=active]:shadow-sm font-bold",
                theme === 'modern' && "rounded-xl data-[state=active]:text-primary data-[state=active]:bg-white/90"
              )}
            >
              Arrived ({arrivedAppointments.length})
            </TabsTrigger>
            <TabsTrigger 
              value="pending"
              className={cn(
                "rounded-lg data-[state=active]:bg-white data-[state=active]:text-theme-blue data-[state=active]:shadow-sm font-bold",
                theme === 'modern' && "rounded-xl data-[state=active]:text-primary data-[state=active]:bg-white/90"
              )}
            >
              Pending ({pendingAppointments.length})
            </TabsTrigger>
            <TabsTrigger 
              value="skipped"
              className={cn(
                "rounded-lg data-[state=active]:bg-white data-[state=active]:text-theme-blue data-[state=active]:shadow-sm font-bold",
                theme === 'modern' && "rounded-xl data-[state=active]:text-primary data-[state=active]:bg-white/90"
              )}
            >
              Action Required ({skippedAppointments.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pb-20">
          <TabsContent value="arrived" className="m-0 focus-visible:ring-0">
            <AppointmentList
              appointments={arrivedAppointments}
              onUpdateStatus={handleUpdateAppointmentStatus}
              onRejoinQueue={(appt) => { handleUpdateAppointmentStatus(appt.id, 'Confirmed'); }}
              clinicStatus={currentDoctor?.consultationStatus as 'In' | 'Out'}
              currentTime={currentTime}
              showTopRightActions={false}
              showStatusBadge={true}
              averageConsultingTime={currentDoctor?.averageConsultingTime}
            />
          </TabsContent>
          <TabsContent value="pending" className="m-0 focus-visible:ring-0">
            <AppointmentList
              appointments={pendingAppointments}
              onUpdateStatus={handleUpdateAppointmentStatus}
              onAddToQueue={(appt) => { handleUpdateAppointmentStatus(appt.id, 'Confirmed'); }}
              onRejoinQueue={(appt) => { handleUpdateAppointmentStatus(appt.id, 'Confirmed'); }}
              clinicStatus={currentDoctor?.consultationStatus as 'In' | 'Out'}
              currentTime={currentTime}
              showTopRightActions={false}
              showStatusBadge={false}
              averageConsultingTime={currentDoctor?.averageConsultingTime}
            />
          </TabsContent>
          <TabsContent value="skipped" className="m-0 focus-visible:ring-0">
            <AppointmentList
              appointments={skippedAppointments}
              onUpdateStatus={handleUpdateAppointmentStatus}
              onAddToQueue={(appt) => { handleUpdateAppointmentStatus(appt.id, 'Confirmed'); }}
              onRejoinQueue={(appt) => { handleUpdateAppointmentStatus(appt.id, 'Confirmed'); }}
              clinicStatus={currentDoctor?.consultationStatus as 'In' | 'Out'}
              currentTime={currentTime}
              showTopRightActions={false}
              showStatusBadge={true}
              averageConsultingTime={currentDoctor?.averageConsultingTime}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
