
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, WifiOff } from 'lucide-react';
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
  const { data, loading, error, updateDoctorStatus, updateAppointmentStatus } = useNurseDashboard(clinicId);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(searchParams.get('doctor') || '');
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
    localStorage.setItem('selectedDoctorId', id);
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
        a.tokenNumber.toLowerCase().includes(lowerSearch)
      );
    }
    return filtered;
  }, [data, selectedDoctorId, searchTerm]);

  const arrivedAppointments = useMemo(() => 
    filteredAppointments.filter(a => ['Confirmed', 'Skipped'].includes(a.status)),
    [filteredAppointments]
  );

  const pendingAppointments = useMemo(() => 
    filteredAppointments.filter(a => a.status === 'Pending'),
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
        selectedDoctor={selectedDoctorId}
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
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className={cn("px-4 pt-4 bg-white", theme === 'modern' && "bg-transparent")}>
          <TabsList className={cn("w-full grid grid-cols-2 h-12 p-1 bg-slate-100 rounded-xl", theme === 'modern' && "bg-muted/30 border border-white/20 h-14 rounded-2xl")}>
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
        </div>
      </Tabs>
    </div>
  );
}
