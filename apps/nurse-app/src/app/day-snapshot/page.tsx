'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  format, addDays, subDays, isSameDay, isPast, endOfDay, addMinutes
} from 'date-fns';
import {
  BarChart3, Users, CheckCircle2, XCircle, UserMinus, Clock, Coffee, Plus, Loader2, Calendar as CalendarIcon, TrendingUp, ArrowRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import { Button } from '@/components/ui/button';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import ClinicHeader from '@/components/clinic/ClinicHeader';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AppointmentDatePicker } from '@/components/appointments/AppointmentDatePicker';
import { cn } from '@/lib/utils';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { NurseDesktopShell } from '@/components/layout/NurseDesktopShell';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { Appointment, Doctor } from '@kloqo/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DaySnapshotPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDoctor, setSelectedDoctor] = useState<string>(searchParams.get('doctor') || '');
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

  // Auto-select first doctor and sync with URL
  useEffect(() => {
    if (data?.doctors?.length && !selectedDoctor) {
      const stored = localStorage.getItem('selectedDoctorId');
      const urlDocId = searchParams.get('doctor');
      const found = data.doctors.find(d => d.id === (urlDocId || stored));
      const initialId = found ? found.id : data.doctors[0].id;
      
      setSelectedDoctor(initialId);
      
      if (urlDocId !== initialId) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('doctor', initialId);
        router.replace(`?${params.toString()}`);
      }
    }
  }, [data?.doctors, selectedDoctor, searchParams, router]);

  const handleDoctorChange = (id: string) => {
    setSelectedDoctor(id);
    localStorage.setItem('selectedDoctorId', id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('doctor', id);
    router.replace(`?${params.toString()}`);
  };

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
    // Default to 7 days if not set, or use the doctor's specific setting
    const range = (currentDoctor as any)?.advanceBookingDays ?? 7;
    
    // Always include Today + Next N Days
    const standardDates = Array.from({ length: range + 1 }, (_, i) => addDays(today, i));
    
    // If the selected date is already in our standard range, just return it
    const isSelectedInStandard = standardDates.some(d => isSameDay(d, selectedDate));
    if (isSelectedInStandard) return standardDates;
    
    // If selected date is NOT in standard range (e.g. past or far future via calendar),
    // we show a 7-day window around it.
    const customWindow = Array.from({ length: 7 }, (_, i) => addDays(subDays(selectedDate, 3), i));
    return customWindow;
  }, [selectedDate, currentDoctor?.advanceBookingDays]);

  const mobileView = (
    <AppFrameLayout showBottomNav>
      <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        <ClinicHeader
          doctors={(data?.doctors ?? []) as Doctor[]}
          selectedDoctor={selectedDoctor}
          onDoctorChange={handleDoctorChange}
          showLogo={false}
          pageTitle="Day Snapshot"
          showSettings={false}
        />

        <main className="flex-1 p-4 -mt-6 z-10 bg-white rounded-t-3xl shadow-xl flex flex-col gap-6 overflow-hidden">
          {/* Date Selector */}
          <AppointmentDatePicker 
            dates={dates} 
            selectedDate={selectedDate} 
            onSelectDate={(d) => { setSelectedDate(d); setActiveSession('all'); }} 
          />

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
       <div className="max-w-7xl mx-auto space-y-10 py-10 px-6 font-pt-sans animate-in fade-in slide-in-from-bottom-4 duration-700">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-white" />
                   </div>
                   <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 font-black uppercase tracking-widest text-[10px] px-3 py-1">
                     Clinical Metrics Hub
                   </Badge>
                </div>
                <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none">Day Snapshot<span className="text-blue-600">.</span></h1>
                <p className="text-slate-500 font-bold max-w-md leading-relaxed">
                  Real-time clinical throughput analytics and session-specific break management.
                </p>
              </div>
              
              <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-premium border border-slate-100">
                <div className="px-6 py-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Focus Date</p>
                  <p className="text-sm font-black text-slate-900">{format(selectedDate, 'MMMM d, yyyy')}</p>
                </div>
              </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Column: Stats & Calendar */}
            <div className="lg:col-span-4 space-y-10">
              {/* Date Selection Card */}
              <AppointmentDatePicker 
                dates={dates} 
                selectedDate={selectedDate} 
                onSelectDate={(d) => { setSelectedDate(d); setActiveSession('all'); }} 
                isTablet 
              />

              {/* Session Filter */}
              {sessions.length > 0 && (
                <Card className="rounded-[3rem] border-none shadow-premium bg-slate-900 p-8 text-white">
                   <div className="flex items-center gap-3 mb-8">
                      <Clock className="h-5 w-5 text-blue-400" />
                      <h3 className="font-black text-white uppercase tracking-tight text-sm">Session Focus</h3>
                   </div>
                   <div className="space-y-3">
                      <button 
                        onClick={() => setActiveSession('all')}
                        className={cn(
                          "w-full p-5 rounded-2xl flex items-center justify-between transition-all font-bold",
                          activeSession === 'all' ? "bg-white text-slate-900 shadow-lg" : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}
                      >
                        <span className="text-sm">Comprehensive View</span>
                        {activeSession === 'all' && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                      {sessions.map((session: any, index: number) => (
                        <button 
                          key={index}
                          onClick={() => setActiveSession(index.toString())}
                          className={cn(
                            "w-full p-5 rounded-2xl flex items-center justify-between transition-all font-bold",
                            activeSession === index.toString() ? "bg-white text-slate-900 shadow-lg" : "bg-white/5 text-white/60 hover:bg-white/10"
                          )}
                        >
                          <span className="text-sm">{session.from} - {session.to}</span>
                          {activeSession === index.toString() && <CheckCircle2 className="h-4 w-4" />}
                        </button>
                      ))}
                   </div>
                </Card>
              )}
            </div>

            {/* Right/Main Column: Analytics Grid & Breaks */}
            <div className="lg:col-span-8 space-y-10">
               {/* Premium Stats Grid */}
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Total Bookings - Featured */}
                  <Card className="col-span-2 lg:col-span-1 rounded-[3rem] border-none shadow-premium bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-white relative overflow-hidden group">
                     <Users className="absolute top-[-20%] right-[-10%] w-40 h-40 opacity-10 rotate-12 transition-transform group-hover:scale-110" />
                     <div className="relative z-10">
                        <p className="text-blue-100/60 text-[10px] font-black uppercase tracking-[0.2em]">Total Appointments</p>
                        <h3 className="text-7xl font-black mt-4 tracking-tighter leading-none">{stats.total}</h3>
                        <div className="mt-6 flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full text-[10px] font-black">
                           <TrendingUp className="h-3 w-3" /> REGISTERED
                        </div>
                     </div>
                  </Card>

                  {/* Arrived/Waiting */}
                  <Card className="rounded-[3rem] border-none shadow-premium bg-white p-8 border border-slate-100 group hover:border-amber-200 transition-all">
                     <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-sm group-hover:scale-110 transition-transform">
                           <Clock className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Active Queue</span>
                     </div>
                     <h3 className="text-5xl font-black text-slate-900">{stats.confirmed}</h3>
                     <p className="text-slate-400 font-bold text-xs mt-3 uppercase tracking-widest leading-none">Arrived at Clinic</p>
                  </Card>

                  {/* Completed */}
                  <Card className="rounded-[3rem] border-none shadow-premium bg-white p-8 border border-slate-100 group hover:border-emerald-200 transition-all">
                     <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                           <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Fulfillment</span>
                     </div>
                     <h3 className="text-5xl font-black text-slate-900">{stats.completed}</h3>
                     <p className="text-slate-400 font-bold text-xs mt-3 uppercase tracking-widest leading-none">Consultations Done</p>
                  </Card>
               </div>

               {/* Breaks & Attrition Grid */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Break Schedule */}
                  <Card className="rounded-[3.5rem] border-none shadow-premium bg-white p-10 border border-slate-100">
                     <div className="flex items-center justify-between mb-10">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                              <Coffee className="h-6 w-6" />
                           </div>
                           <h3 className="text-xl font-black text-slate-900 tracking-tight">Break Schedule</h3>
                        </div>
                        {selectedDoctor && (
                           <Button 
                             onClick={() => router.push(`/schedule-break?doctor=${selectedDoctor}`)}
                             variant="outline" 
                             className="rounded-2xl border-slate-200 font-black text-[10px] uppercase tracking-widest h-12 px-6 hover:bg-slate-50 transition-all"
                           >
                             <Plus className="h-4 w-4 mr-2" /> Add Period
                           </Button>
                        )}
                     </div>

                     <div className="space-y-5">
                        {breaks.length > 0 ? (
                           breaks.map((brk: any, i: number) => (
                              <div key={i} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 group hover:bg-amber-50/50 hover:border-amber-200 transition-all">
                                 <div className="flex items-center gap-5">
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                                       <Clock className="h-5 w-5 text-amber-500" />
                                    </div>
                                    <div className="flex flex-col">
                                       <span className="font-black text-slate-900 text-xl tracking-tight leading-none">
                                          {format(new Date(brk.startTime), 'hh:mm a')}
                                       </span>
                                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Start Time</span>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <ArrowRight className="h-4 w-4 text-slate-300" />
                                    <div className="flex flex-col items-end">
                                       <span className="font-black text-slate-900 text-xl tracking-tight leading-none">
                                          {format(new Date(brk.endTime), 'hh:mm a')}
                                       </span>
                                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">End Time</span>
                                    </div>
                                 </div>
                              </div>
                           ))
                        ) : (
                           <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/30">
                              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                 <Coffee className="h-8 w-8 text-slate-200" />
                              </div>
                              <p className="text-slate-400 font-bold text-sm tracking-tight">No clinical pauses scheduled today</p>
                           </div>
                        )}
                     </div>
                  </Card>

                  {/* Attrition/Missed Stats */}
                  <Card className="rounded-[3.5rem] border-none shadow-premium bg-slate-50 p-10 border border-slate-100">
                     <div className="flex items-center gap-4 mb-10">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
                           <XCircle className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Clinical Attrition</h3>
                     </div>

                     <div className="space-y-6">
                        {[
                           { label: 'Cancelled', value: stats.cancelled, color: 'bg-red-500', bg: 'bg-red-50/30' },
                           { label: 'No-show', value: stats.noshow, color: 'bg-amber-500', bg: 'bg-amber-50/30' },
                           { label: 'Skipped', value: stats.skipped, color: 'bg-orange-500', bg: 'bg-orange-50/30' },
                        ].map(item => (
                           <div key={item.label} className={cn("p-6 rounded-3xl flex items-center justify-between border border-white shadow-sm", item.bg)}>
                              <div className="flex items-center gap-4">
                                 <div className={cn("w-3 h-3 rounded-full shadow-sm", item.color)} />
                                 <span className="font-black text-slate-600 uppercase tracking-widest text-[11px]">{item.label}</span>
                              </div>
                              <span className="text-3xl font-black text-slate-900 tabular-nums">{item.value}</span>
                           </div>
                        ))}
                        
                        <div className="pt-10 mt-6 border-t border-slate-200/60">
                           <div className="flex justify-between items-end">
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Leakage</p>
                                 <p className="text-4xl font-black text-red-600 tabular-nums leading-none">
                                    {stats.cancelled + stats.noshow + stats.skipped}
                                 </p>
                              </div>
                              <div className="text-right">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-tight mb-2">
                                    IMPACT<br />ANALYSIS
                                 </p>
                                 <TrendingUp className="h-6 w-6 text-red-100 ml-auto" />
                              </div>
                           </div>
                        </div>
                     </div>
                  </Card>
               </div>
            </div>
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
