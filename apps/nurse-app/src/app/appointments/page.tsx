'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, isSameDay, addDays, subDays } from 'date-fns';
import { Loader2, Search, CalendarDays } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import ClinicHeader from '@/components/clinic/ClinicHeader';
import AppointmentList from '@/components/clinic/AppointmentList';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Appointment, Doctor } from '@kloqo/shared';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AppointmentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [dateAppointments, setDateAppointments] = useState<Appointment[]>([]);
  const [dateLoading, setDateLoading] = useState(false);

  const clinicId = user?.clinicId;
  const { data, loading: dashLoading, updateAppointmentStatus } = useNurseDashboard(clinicId);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // Auto-select first doctor
  useEffect(() => {
    if (data?.doctors?.length && !selectedDoctor) {
      const stored = localStorage.getItem('selectedDoctorId');
      const found = data.doctors.find(d => d.id === stored);
      setSelectedDoctor(found ? found.id : data.doctors[0].id);
    }
  }, [data?.doctors, selectedDoctor]);

  // Fetch appointments for selected date
  useEffect(() => {
    if (!clinicId || !selectedDoctor) return;
    const isToday = isSameDay(selectedDate, new Date());

    if (isToday && data?.appointments) {
      setDateAppointments(data.appointments);
      return;
    }

    const fetchForDate = async () => {
      setDateLoading(true);
      try {
        const dateStr = format(selectedDate, 'd MMMM yyyy');
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/appointments/dashboard?clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setDateAppointments(json.appointments ?? []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setDateLoading(false);
      }
    };
    fetchForDate();
  }, [clinicId, selectedDate, selectedDoctor, data?.appointments]);

  const handleDoctorChange = (id: string) => {
    setSelectedDoctor(id);
    localStorage.setItem('selectedDoctorId', id);
  };

  const currentDoctor = data?.doctors.find(d => d.id === selectedDoctor);

  const filteredAppointments = useMemo(() => {
    const doctorName = currentDoctor?.name;
    return dateAppointments
      .filter(a => !doctorName || a.doctorName === doctorName)
      .filter(a =>
        !searchTerm.trim() ||
        a.patientName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [dateAppointments, currentDoctor, searchTerm]);

  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 365 }, (_, i) => addDays(subDays(today, 90), i));
  }, []);

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

  const mobileView = (
    <AppFrameLayout showBottomNav>
      <div className="flex flex-col h-full bg-muted/20">
        <ClinicHeader
          doctors={(data?.doctors ?? []) as Doctor[]}
          selectedDoctor={selectedDoctor}
          onDoctorChange={handleDoctorChange}
          showLogo={false}
          showSettings={false}
          pageTitle="All Appointments"
        />

        <main className="flex-1 flex flex-col min-h-0 bg-card rounded-t-3xl -mt-4 z-10">
          <div className="p-4 border-b">
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="font-black text-sm text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-theme-blue" />
                {format(selectedDate, 'MMMM yyyy')}
              </h2>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="text-[10px] font-black text-theme-blue bg-blue-50 px-3 py-1.5 rounded-full uppercase tracking-wider hover:bg-blue-100 transition-colors"
              >
                Today
              </button>
            </div>
            <div className="-mx-1">
              <div className="flex gap-1 px-1 w-max">
                {dates.map((d, index) => {
                  const isSelected = isSameDay(d, selectedDate);
                  const isToday = isSameDay(d, new Date());
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(d)}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-2xl gap-0.5 transition-all duration-200 border-2 min-w-[52px]',
                        isSelected
                          ? 'bg-theme-blue text-white border-theme-blue shadow-lg scale-105'
                          : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100',
                        isToday && !isSelected && 'border-theme-blue border-dashed'
                      )}
                    >
                      <span className={cn('text-[9px] font-bold uppercase', isSelected ? 'text-blue-100' : 'text-slate-400')}>
                        {format(d, 'EEE')}
                      </span>
                      <span className="text-base font-black leading-none">{format(d, 'dd')}</span>
                      {isToday && (
                        <div className={cn('w-1 h-1 rounded-full', isSelected ? 'bg-white' : 'bg-theme-blue')} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search patients..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl bg-slate-50 border-slate-200"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {dateLoading ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-theme-blue" />
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <CalendarDays className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm font-medium">No appointments found</p>
                <p className="text-xs opacity-70">{format(selectedDate, 'MMMM d, yyyy')}</p>
              </div>
            ) : (
              <AppointmentList
                appointments={filteredAppointments}
                onUpdateStatus={updateAppointmentStatus}
                showStatusBadge={true}
                showTopRightActions={false}
                clinicStatus={(currentDoctor?.consultationStatus ?? 'Out') as 'In' | 'Out'}
              />
            )}
          </div>
        </main>
      </div>
    </AppFrameLayout>
  );

  const tabletView = (
    <TabletDashboardLayout>
      <div className="space-y-8 py-4 animate-in fade-in duration-700">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight tracking-tight">Bookings</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2 px-1">Manage Appointments for {format(selectedDate, 'MMMM d, yyyy')}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Date Picker & Filter */}
            <div className="lg:col-span-4 space-y-6 sticky top-24">
                <div className="p-8 rounded-[2.5rem] bg-white shadow-premium border border-slate-50 space-y-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-black text-sm text-slate-800 uppercase tracking-tight flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-theme-blue" />
                            Date Selector
                        </h2>
                        <button
                            onClick={() => setSelectedDate(new Date())}
                            className="text-[10px] font-black text-primary bg-primary/5 px-4 py-2 rounded-xl uppercase tracking-wider hover:bg-primary/10 transition-all"
                        >
                            Today
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {dates.slice(85, 105).map((d, index) => {
                          const isSelected = isSameDay(d, selectedDate);
                          const isToday = isSameDay(d, new Date());
                          return (
                            <button
                              key={index}
                              onClick={() => setSelectedDate(d)}
                              className={cn(
                                'flex flex-col items-center justify-center p-3 rounded-2xl gap-0.5 transition-all duration-300 border-2',
                                isSelected
                                  ? 'bg-primary text-white border-primary shadow-lg scale-105'
                                  : 'bg-slate-50 border-slate-50 text-slate-600 hover:bg-slate-100 hover:scale-105',
                                isToday && !isSelected && 'border-primary/30 border-dashed'
                              )}
                            >
                              <span className={cn('text-[8px] font-black uppercase', isSelected ? 'text-white/80' : 'text-slate-400')}>
                                {format(d, 'EEE')}
                              </span>
                              <span className="text-sm font-black leading-none mt-0.5">{format(d, 'dd')}</span>
                            </button>
                          );
                        })}
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search patients..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-11 h-12 bg-slate-50 border-none rounded-2xl placeholder:font-medium placeholder:text-slate-400 focus-visible:ring-primary/20"
                        />
                    </div>
                </div>
            </div>

            {/* Right: Appointment List */}
            <div className="lg:col-span-8">
                <div className="bg-white shadow-premium rounded-[2.5rem] border border-slate-50 overflow-hidden min-h-[600px] flex flex-col">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Appointments List</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Found {filteredAppointments.length} patients</p>
                    </div>

                    <div className="flex-1 p-4">
                        {dateLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                        ) : filteredAppointments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 opacity-40">
                            <CalendarDays className="h-16 w-16 mb-4" />
                            <p className="text-lg font-black uppercase tracking-widest">No appointments found</p>
                        </div>
                        ) : (
                        <div className="px-2">
                             <AppointmentList
                                appointments={filteredAppointments}
                                onUpdateStatus={updateAppointmentStatus}
                                showStatusBadge={true}
                                showTopRightActions={false}
                                clinicStatus={(currentDoctor?.consultationStatus ?? 'Out') as 'In' | 'Out'}
                            />
                        </div>
                        )}
                    </div>
                </div>
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
