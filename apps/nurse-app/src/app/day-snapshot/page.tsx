'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  format, addDays, subDays, isSameDay, isPast, endOfDay, addMinutes
} from 'date-fns';
import {
  BarChart3, Users, CheckCircle2, XCircle, UserMinus, Clock, Coffee, Plus, Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import ClinicHeader from '@/components/clinic/ClinicHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { NurseDesktopShell } from '@/components/layout/NurseDesktopShell';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { Appointment, Doctor } from '@kloqo/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DaySnapshotPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [activeSession, setActiveSession] = useState<string>('all');
  const [dateAppointments, setDateAppointments] = useState<Appointment[]>([]);
  const [dateLoading, setDateLoading] = useState(false);

  const clinicId = user?.clinicId;
  const { data, loading: dashLoading } = useNurseDashboard(clinicId);
  const { activeRole } = useActiveIdentity();

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

  const currentDoctor = data?.doctors.find(d => d.id === selectedDoctor);

  // Get sessions for selected day
  const sessions = useMemo(() => {
    if (!currentDoctor) return [];
    const dayName = format(selectedDate, 'EEEE');
    const avail = (currentDoctor as any).availabilitySlots?.find((s: any) => s.day === dayName);
    return avail?.timeSlots || [];
  }, [currentDoctor, selectedDate]);

  // Filter by doctor name and session
  const filteredAppointments = useMemo(() => {
    const doctorName = currentDoctor?.name;
    let appts = dateAppointments.filter(a => !doctorName || a.doctorName === doctorName);
    if (activeSession !== 'all') {
      const idx = parseInt(activeSession);
      appts = appts.filter(a => (a as any).sessionIndex === idx);
    }
    return appts;
  }, [dateAppointments, currentDoctor, activeSession]);

  const isPastDate = isPast(endOfDay(selectedDate)) && !isSameDay(selectedDate, new Date());

  const stats = useMemo(() => ({
    total: filteredAppointments.length,
    pending: filteredAppointments.filter(a => a.status === 'Pending').length,
    confirmed: filteredAppointments.filter(a => a.status === 'Confirmed').length,
    completed: filteredAppointments.filter(a => a.status === 'Completed').length,
    cancelled: filteredAppointments.filter(a => a.status === 'Cancelled').length,
    noshow: filteredAppointments.filter(a => a.status === 'No-show').length,
    skipped: filteredAppointments.filter(a => a.status === 'Skipped').length,
  }), [filteredAppointments]);

  const breaks = useMemo(() => {
    if (!(currentDoctor as any)?.breakPeriods) return [];
    const dateKey = format(selectedDate, 'd MMMM yyyy');
    return (currentDoctor as any).breakPeriods[dateKey] || [];
  }, [currentDoctor, selectedDate]);

  // Generate 7 before + 14 after today
  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 22 }, (_, i) => addDays(subDays(today, 7), i));
  }, []);

  const mobileView = (
    <AppFrameLayout showBottomNav>
      <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        <ClinicHeader
          doctors={(data?.doctors ?? []) as Doctor[]}
          selectedDoctor={selectedDoctor}
          onDoctorChange={setSelectedDoctor}
          showLogo={false}
          pageTitle="Day Snapshot"
          showSettings={false}
        />

        <main className="flex-1 p-4 -mt-6 z-10 bg-white rounded-t-3xl shadow-xl flex flex-col gap-6 overflow-hidden">
          {/* Date Carousel */}
          <div>
            <div className="flex justify-between items-center mb-3 px-2">
              <h2 className="font-black text-base text-slate-800 uppercase tracking-tight">Select Date</h2>
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                {format(selectedDate, 'MMMM yyyy')}
              </span>
            </div>
            <div className="-mx-1">
              <div className="flex gap-1.5 px-1 w-max">
                {dates.map((d, index) => {
                  const isSelected = isSameDay(d, selectedDate);
                  const isToday = isSameDay(d, new Date());
                  return (
                    <button
                      key={index}
                      onClick={() => { setSelectedDate(d); setActiveSession('all'); }}
                      className={cn(
                        'flex flex-col items-center justify-center p-2.5 rounded-2xl gap-0.5 transition-all duration-200 border-2 min-w-[52px]',
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105'
                          : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100',
                        isToday && !isSelected && 'border-blue-200'
                      )}
                    >
                      <span className={cn('text-[9px] font-bold uppercase', isSelected ? 'text-blue-100' : 'text-slate-400')}>
                        {format(d, 'EEE')}
                      </span>
                      <span className="text-base font-black leading-none">{format(d, 'dd')}</span>
                      {isToday && <div className={cn('w-1 h-1 rounded-full', isSelected ? 'bg-white' : 'bg-blue-600')} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-6 scrollbar-hide">
            {/* Session Tabs */}
            {sessions.length > 0 && (
              <div className="px-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Filter by Session</h3>
                <Tabs value={activeSession} onValueChange={setActiveSession}>
                  <TabsList className="bg-slate-100/50 h-auto p-1.5 w-full flex gap-1 border border-slate-100 rounded-2xl">
                    <TabsTrigger value="all" className="flex-1 rounded-xl py-2 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                      All Day
                    </TabsTrigger>
                    {sessions.map((session: any, index: number) => (
                      <TabsTrigger key={index} value={index.toString()} className="flex-1 rounded-xl py-2 font-bold text-[10px] data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                        {session.from} - {session.to}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Stats Grid */}
            {dateLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-none shadow-sm bg-blue-50/50 rounded-2xl ring-1 ring-blue-100/50">
                  <CardContent className="p-4 flex flex-col items-center justify-center">
                    <div className="bg-blue-100 p-2.5 rounded-2xl mb-3">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="text-3xl font-black text-blue-700">{stats.total}</p>
                    <p className="text-[10px] uppercase font-black text-blue-400 tracking-wider mt-1">Total Bookings</p>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-amber-50/50 rounded-2xl ring-1 ring-amber-100/50">
                  <CardContent className="p-4 flex flex-col items-center justify-center">
                    <div className="bg-amber-100 p-2.5 rounded-2xl mb-3">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="text-3xl font-black text-amber-700">{stats.confirmed}</p>
                    <p className="text-[10px] uppercase font-black text-amber-400 tracking-wider mt-1">Waiting in Clinic</p>
                  </CardContent>
                </Card>

                {isPastDate || stats.completed > 0 ? (
                  <Card className="border-none shadow-sm bg-green-50/50 rounded-2xl ring-1 ring-green-100/50">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                      <div className="bg-green-100 p-2.5 rounded-2xl mb-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                      <p className="text-3xl font-black text-green-700">{stats.completed}</p>
                      <p className="text-[10px] uppercase font-black text-green-400 tracking-wider mt-1">Completed</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-none shadow-sm bg-slate-50/50 rounded-2xl ring-1 ring-slate-100/50">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                      <div className="bg-slate-100 p-2.5 rounded-2xl mb-3">
                        <UserMinus className="h-5 w-5 text-slate-600" />
                      </div>
                      <p className="text-3xl font-black text-slate-700">{stats.pending}</p>
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mt-1">Not Arrived</p>
                    </CardContent>
                  </Card>
                )}

                {(isPastDate || isSameDay(selectedDate, new Date())) && (
                  <Card className="border-none shadow-sm bg-red-50/50 rounded-2xl ring-1 ring-red-100/50">
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                      <div className="bg-red-100 p-2.5 rounded-2xl mb-3">
                        <XCircle className="h-5 w-5 text-red-600" />
                      </div>
                      <p className="text-3xl font-black text-red-700">{stats.cancelled + stats.noshow + stats.skipped}</p>
                      <p className="text-[10px] uppercase font-black text-red-400 tracking-wider mt-1">
                        {isPastDate ? 'Missed/Cancelled' : 'Skipped/Missed'}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Past Performance Details */}
            {isPastDate && (
              <div className="bg-slate-50 rounded-2xl p-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Past Performance</h3>
                <div className="space-y-2">
                  {[
                    { label: 'Cancelled', value: stats.cancelled, color: 'bg-red-500', textColor: 'text-red-600' },
                    { label: 'No-show', value: stats.noshow, color: 'bg-amber-500', textColor: 'text-amber-600' },
                    { label: 'Skipped', value: stats.skipped, color: 'bg-orange-500', textColor: 'text-orange-600' },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center text-sm font-bold">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-slate-600">{item.label}</span>
                      </div>
                      <span className={item.textColor}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Break Schedule */}
            <div className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coffee className="h-5 w-5 text-amber-600" />
                  <h3 className="font-black text-slate-800 uppercase tracking-tight">Break Schedule</h3>
                </div>
                {selectedDoctor && (
                  <button
                    onClick={() => router.push(`/schedule-break?doctor=${selectedDoctor}`)}
                    className="h-8 w-8 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
              {breaks.length > 0 ? (
                breaks.map((brk: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="font-bold text-amber-800">
                        {format(new Date(brk.startTime), 'hh:mm a')} - {format(new Date(brk.endTime), 'hh:mm a')}
                      </span>
                    </div>
                    <Badge className="bg-amber-200 text-amber-800 hover:bg-amber-200 border-none px-3 py-1 font-bold text-[10px] uppercase">
                      Scheduled
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm font-bold text-slate-400 italic">No breaks scheduled for this day</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </AppFrameLayout>
  );

  const tabletView = (
    <TabletDashboardLayout 
      hideSidebar={activeRole === 'nurse'}
      hideRightPanel={activeRole === 'nurse'}
    >
       <div className="flex flex-col h-full bg-slate-50 overflow-hidden py-8">
          <header className="mb-8">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Day Snapshot</h1>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2 px-1">Clinic performance and break schedule</p>
          </header>
          <div className="flex-1 overflow-y-auto">
             {mobileView}
          </div>
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
