'use client';

import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  PhoneCall,
  Search,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ArrowRight,
  Calendar,
  Hash,
  User,
  Ticket,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookingDrawer } from './BookingDrawer';
import { PatientSearchBanner } from '../phone-booking/PatientSearchBanner';
import { PatientMatchList } from '../phone-booking/PatientMatchList';
import { PatientRegistrationForm } from '../phone-booking/PatientRegistrationForm';
import { AddRelativeDialog } from '../patients/AddRelativeDialog';
import AppointmentList from '../clinic/AppointmentList';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { useWalkInFlow } from '@/hooks/useWalkInFlow';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { format, addDays, isSameDay, subMinutes } from 'date-fns';
import { getClinicNow, displayTime12h } from '@kloqo/shared-core';
import { Appointment } from '@kloqo/shared';

interface DoctorSidebarPanelProps {
  onSelectAppointment?: (appointment: Appointment) => void;
  selectedAppointmentId?: string | null;
}

export function DoctorSidebarPanel({ onSelectAppointment, selectedAppointmentId }: DoctorSidebarPanelProps) {
  const { data, selectedDoctorId, updateAppointmentStatus } = useNurseDashboardContext();
  const { toast } = useToast();

  // ─── Booking State ────────────────────────────────────────────────────────
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false);
  const [bookingMode, setBookingMode] = useState<'walk-in' | 'advanced'>('walk-in');

  // Advanced Booking State
  const [advancedStep, setAdvancedStep] = useState<'identify' | 'slots' | 'confirm' | 'success'>('identify');
  const [selectedDate, setSelectedDate] = useState<Date>(getClinicNow());
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [reschedulingApptId, setReschedulingApptId] = useState<string | null>(null);

  // ─── Queue / Filter State ─────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('arrived');

  // ─── Walk-in Flow ─────────────────────────────────────────────────────────
  const walkIn = useWalkInFlow({ doctorId: selectedDoctorId, clinicId: data?.clinic?.id });

  const handleWalkInOpen = () => {
    setBookingMode('walk-in');
    walkIn.setCurrentStep('identify');
    setIsBookingDrawerOpen(true);
  };

  const handleAdvancedOpen = () => {
    setBookingMode('advanced');
    setAdvancedStep('identify');
    walkIn.setPhoneNumber('');
    walkIn.selectPatient(null);
    walkIn.setCurrentStep('identify');
    setReschedulingApptId(null);
    setIsBookingDrawerOpen(true);
  };

  const handleReschedule = (appt: any) => {
    handleAdvancedOpen();
    setAdvancedStep('slots');
    setReschedulingApptId(appt.id);
    const apptPatient = {
      id: appt.patientId,
      name: appt.patientName,
      phone: appt.communicationPhone || '',
      communicationPhone: appt.communicationPhone || '',
      age: appt.age,
      sex: appt.sex,
      place: appt.place,
    };
    walkIn.setPhoneNumber(appt.communicationPhone || '');
    walkIn.selectPatient(apptPatient, true);
    fetchSlots(selectedDate);
  };

  // ─── Slots ────────────────────────────────────────────────────────────────
  const fetchSlots = async (date: Date) => {
    if (!selectedDoctorId || !data?.clinic?.id) return;
    setLoadingSlots(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await apiRequest<any>(
        `/appointments/available-slots?doctorId=${selectedDoctorId}&clinicId=${data.clinic.id}&date=${encodeURIComponent(dateStr)}`
      );
      setSlots(response.slots || []);
      setSelectedSlot(null);
    } catch {
      toast({ variant: 'destructive', title: 'Slot Error', description: 'Could not load availability.' });
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleAdvancedBook = async () => {
    if (!selectedSlot || !walkIn.selectedPatient || !selectedDoctorId || !data?.clinic?.id) return;
    setIsBooking(true);
    try {
      const patientId = walkIn.selectedPatient?.id || walkIn.selectedPatient?._id;
      await apiRequest('/appointments/book', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          clinicId: data.clinic.id,
          patientId,
          date: format(selectedDate, 'd MMMM yyyy'),
          slotTime: format(new Date(selectedSlot.time), 'hh:mm a'),
          time: format(new Date(selectedSlot.time), 'hh:mm a'),
          slotIndex: selectedSlot.slotIndex,
          sessionIndex: selectedSlot.sessionIndex,
          source: 'Doctor_Sidebar',
          rescheduleFromId: reschedulingApptId || undefined,
        }),
      });
      setAdvancedStep('success');
      setReschedulingApptId(null);
      toast({ title: '✅ Appointment Booked', description: 'Slot locked. Queue will update in real-time.' });
    } catch (error: any) {
      const isConflict = (error as any)?.status === 409;
      toast({
        variant: 'destructive',
        title: isConflict ? 'Slot Already Taken' : 'Booking Failed',
        description: isConflict ? 'Someone just grabbed this slot. Please pick another.' : error.message,
      });
    } finally {
      setIsBooking(false);
    }
  };

  const nextDates = useMemo(() => {
    const today = getClinicNow();
    return Array.from({ length: 14 }, (_, i) => addDays(today, i));
  }, []);

  // ─── Appointment Filtering ────────────────────────────────────────────────
  const filteredAppointments = useMemo(() => {
    if (!data?.appointments || !selectedDoctorId) return [];
    let filtered = data.appointments.filter((a) => a.doctorId === selectedDoctorId);
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.patientName.toLowerCase().includes(lower) ||
          a.tokenNumber?.toLowerCase().includes(lower) ||
          (a as any).communicationPhone?.includes(lower)
      );
    }
    return filtered;
  }, [data, selectedDoctorId, searchTerm]);

  const arrivedAppointments = useMemo(
    () => filteredAppointments.filter((a) => ['Confirmed', 'InConsultation'].includes(a.status)),
    [filteredAppointments]
  );
  const pendingAppointments = useMemo(
    () => filteredAppointments.filter((a) => a.status === 'Pending'),
    [filteredAppointments]
  );
  const actionRequiredAppointments = useMemo(
    () => filteredAppointments.filter((a) => ['Skipped', 'No-show'].includes(a.status)),
    [filteredAppointments]
  );

  const selectedDoctor = data?.doctors.find((d) => d.id === selectedDoctorId);
  const consultationStatus = (selectedDoctor?.consultationStatus || 'Out') as 'In' | 'Out';

  const handleUpdateStatus = async (id: string, status: string) => {
    await updateAppointmentStatus(id, status);
  };

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* ── Quick Action Buttons ── */}
      <div className="space-y-3">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Quick Actions</span>

        <Button
          onClick={handleWalkInOpen}
          className="w-full h-16 bg-primary hover:bg-primary/90 text-white rounded-[1.75rem] shadow-lg shadow-primary/20 justify-start px-6 gap-4 group transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
            <UserPlus className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-black text-sm leading-none">New Walk-in</p>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mt-1">Arrive Now</p>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 text-white/40 group-hover:translate-x-1 transition-transform" />
        </Button>

        <Button
          onClick={handleAdvancedOpen}
          className="w-full h-16 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/60 rounded-[1.75rem] shadow-sm justify-start px-6 gap-4 group transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
            <PhoneCall className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-black text-sm text-slate-900 leading-none">Book Advanced</p>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">Phone Booking</p>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 text-slate-200 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>

      {/* ── Patient Search ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Search patient, token, phone…"
          className="pl-11 h-11 bg-white border-slate-200/60 rounded-2xl focus-visible:ring-primary/20 text-sm font-medium transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ── Queue Tabs ── */}
      <div className="flex-1 min-h-0 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-slate-100/50 p-1 rounded-2xl h-12 grid grid-cols-3 shrink-0">
            <TabsTrigger
              value="arrived"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 px-2"
            >
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Arrived</span>
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-md bg-emerald-500 text-white text-[9px] font-black px-1">
                {arrivedAppointments.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="pending"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 px-2"
            >
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Pending</span>
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-md bg-amber-500 text-white text-[9px] font-black px-1">
                {pendingAppointments.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="action"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-rose-600 data-[state=active]:shadow-sm font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 px-2"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Action</span>
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-md bg-rose-500 text-white text-[9px] font-black px-1">
                {actionRequiredAppointments.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto custom-scrollbar mt-3 space-y-0">
            <TabsContent value="arrived" className="m-0 focus-visible:ring-0">
              {arrivedAppointments.length === 0 ? (
                <EmptyState icon={<Users className="h-8 w-8 text-slate-200" />} label="No patients in queue" />
              ) : (
                <ArrivedPatientList
                  appointments={arrivedAppointments}
                  selectedId={selectedAppointmentId}
                  onSelect={onSelectAppointment}
                />
              )}
            </TabsContent>

            <TabsContent value="pending" className="m-0 focus-visible:ring-0">
              {pendingAppointments.length === 0 ? (
                <EmptyState icon={<Clock className="h-8 w-8 text-slate-200" />} label="No pending appointments" />
              ) : (
                <AppointmentList
                  appointments={pendingAppointments}
                  onUpdateStatus={handleUpdateStatus}
                  onAddToQueue={(appt) => handleUpdateStatus(appt.id, 'Confirmed')}
                  onRejoinQueue={(appt) => handleUpdateStatus(appt.id, 'Confirmed')}
                  onReschedule={handleReschedule}
                  showTopRightActions={false}
                  clinicStatus={consultationStatus}
                  currentTime={new Date()}
                  showStatusBadge={false}
                />
              )}
            </TabsContent>

            <TabsContent value="action" className="m-0 focus-visible:ring-0">
              {actionRequiredAppointments.length === 0 ? (
                <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-slate-200" />} label="All clear — no action needed" />
              ) : (
                <AppointmentList
                  appointments={actionRequiredAppointments}
                  onUpdateStatus={handleUpdateStatus}
                  onRejoinQueue={(appt) => handleUpdateStatus(appt.id, 'Confirmed')}
                  onReschedule={handleReschedule}
                  showTopRightActions={false}
                  clinicStatus={consultationStatus}
                  currentTime={new Date()}
                  showStatusBadge={true}
                />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* BOOKING DRAWER — rendered here, portal-ed to body      */}
      {/* ═══════════════════════════════════════════════════════ */}
      <BookingDrawer
        isOpen={isBookingDrawerOpen}
        onClose={() => setIsBookingDrawerOpen(false)}
        title={bookingMode === 'walk-in' ? 'Walk-in Registration' : 'Advanced Booking'}
        subtitle={bookingMode === 'walk-in' ? 'Register patient for immediate queue' : 'Schedule patient for future slot'}
      >
        {bookingMode === 'walk-in' ? (
          <div className="space-y-6">
            {walkIn.currentStep !== 'confirm' && (
              <div className="flex gap-2 mb-4">
                <div className={cn('h-1.5 flex-1 rounded-full', walkIn.currentStep === 'identify' ? 'bg-primary' : 'bg-slate-200')} />
                <div className={cn('h-1.5 flex-1 rounded-full', walkIn.currentStep === 'preview' ? 'bg-primary' : 'bg-slate-200')} />
              </div>
            )}

            {walkIn.currentStep === 'identify' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <PatientSearchBanner
                  phoneNumber={walkIn.phoneNumber}
                  setPhoneNumber={walkIn.setPhoneNumber}
                  isSearchingPatient={walkIn.isSearchingPatient}
                  isSendingLink={false}
                  handleSendLink={() => {}}
                  onSearch={walkIn.handlePatientSearch}
                />
                <PatientMatchList
                  phoneNumber={walkIn.phoneNumber}
                  searchedPatients={walkIn.searchedPatients}
                  selectedPatient={walkIn.selectedPatient}
                  onSelectPatient={walkIn.selectPatient}
                  primaryPatient={walkIn.primaryPatient}
                  setIsAddRelativeDialogOpen={walkIn.setIsAddRelativeDialogOpen}
                  linkPendingPatients={[]}
                  showForm={walkIn.showRegistrationForm}
                />
                {walkIn.selectedPatient && !walkIn.showRegistrationForm && (
                  <div className="pt-4 animate-in fade-in slide-in-from-bottom-4">
                    <Button
                      onClick={() => walkIn.setCurrentStep('preview')}
                      className="w-full h-14 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 flex items-center justify-center gap-2 group"
                    >
                      Proceed to Token Preview
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                )}
                {walkIn.showRegistrationForm && (
                  <PatientRegistrationForm
                    form={walkIn.form}
                    onSubmit={walkIn.onRegistrationSubmit}
                    isSubmitting={walkIn.isSubmitting}
                    selectedPatient={walkIn.selectedPatient}
                    primaryPatient={walkIn.primaryPatient}
                    toast={toast}
                    submitLabel="Generate Walk-in Preview"
                  />
                )}
              </div>
            )}

            {walkIn.currentStep === 'preview' && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                {walkIn.isPreviewLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-slate-400 font-black text-xs uppercase tracking-widest text-center">Calculating Token Estimate...</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                          <User className="h-6 w-6 text-slate-400" />
                        </div>
                        <div>
                          <h2 className="font-black text-slate-800 leading-none">
                            {walkIn.selectedPatient?.patientName || walkIn.selectedPatient?.name}
                          </h2>
                          <p className="text-xs font-bold text-slate-400 mt-1">
                            {walkIn.selectedPatient?.sex}, {walkIn.selectedPatient?.age} Years
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => walkIn.setCurrentStep('identify')} className="text-primary font-black text-[10px] uppercase">
                        Change
                      </Button>
                    </div>

                    <Card className="border-none shadow-2xl shadow-primary/10 overflow-hidden rounded-[2.5rem] bg-white">
                      <div className="bg-primary p-8 text-white relative overflow-hidden">
                        <Ticket className="absolute -bottom-6 -right-6 h-40 w-40 text-white/10 rotate-12" />
                        <div className="relative z-10 space-y-6">
                          <span className="inline-block px-3 py-1 bg-white/20 text-white font-black uppercase text-[10px] tracking-widest rounded-full">Estimated Token</span>
                          <div className="flex items-end gap-2">
                            <span className="text-7xl font-black tracking-tighter leading-none">
                              {walkIn.walkInPreview?.placeholderAssignment?.numericToken ||
                                walkIn.walkInPreview?.placeholderAssignment?.tokenNumber?.split('-')[1] ||
                                '??'}
                            </span>
                            <span className="text-2xl font-black opacity-50 mb-1">W</span>
                          </div>
                          <div className="pt-4 border-t border-white/20 flex items-center gap-6">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 opacity-60" />
                              <span className="text-xs font-bold">
                                {walkIn.walkInPreview?.placeholderAssignment?.slotTime
                                  ? displayTime12h(walkIn.walkInPreview.placeholderAssignment.slotTime)
                                  : '...'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 opacity-60" />
                              <span className="text-xs font-bold">Session #{(walkIn.walkInPreview?.placeholderAssignment?.sessionIndex ?? 0) + 1}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <CardContent className="p-8 space-y-6">
                        <Button
                          onClick={async () => {
                            const apt = await walkIn.confirmBooking(true);
                            if (apt) setIsBookingDrawerOpen(false);
                          }}
                          disabled={walkIn.isSubmitting}
                          className="w-full h-16 rounded-[2rem] bg-slate-900 hover:bg-black text-white font-black text-lg shadow-xl shadow-black/20 gap-3"
                        >
                          {walkIn.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <><CheckCircle2 className="h-6 w-6" /> Confirm & Allot Token</>}
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── Advanced Booking ── */
          <div className="space-y-6">
            {advancedStep !== 'success' && (
              <div className="flex gap-2 mb-4">
                <div className={cn('h-1.5 flex-1 rounded-full', advancedStep === 'identify' ? 'bg-primary' : 'bg-slate-200')} />
                <div className={cn('h-1.5 flex-1 rounded-full', advancedStep === 'slots' ? 'bg-primary' : 'bg-slate-200')} />
                <div className={cn('h-1.5 flex-1 rounded-full', advancedStep === 'confirm' ? 'bg-primary' : 'bg-slate-200')} />
              </div>
            )}

            {advancedStep === 'identify' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <PatientSearchBanner
                  phoneNumber={walkIn.phoneNumber}
                  setPhoneNumber={walkIn.setPhoneNumber}
                  isSearchingPatient={walkIn.isSearchingPatient}
                  isSendingLink={false}
                  handleSendLink={() => {}}
                  onSearch={walkIn.handlePatientSearch}
                />
                <PatientMatchList
                  phoneNumber={walkIn.phoneNumber}
                  searchedPatients={walkIn.searchedPatients}
                  selectedPatient={walkIn.selectedPatient}
                  onSelectPatient={(p) => {
                    walkIn.selectPatient(p, true);
                    if (p) {
                      setAdvancedStep('slots');
                      fetchSlots(selectedDate);
                    }
                  }}
                  primaryPatient={walkIn.primaryPatient}
                  setIsAddRelativeDialogOpen={() => {}}
                  linkPendingPatients={[]}
                  showForm={walkIn.showRegistrationForm}
                />
                {walkIn.showRegistrationForm && (
                  <PatientRegistrationForm
                    form={walkIn.form}
                    onSubmit={async (data) => {
                      const p = await walkIn.onRegistrationSubmit(data, true);
                      if (p) {
                        setAdvancedStep('slots');
                        fetchSlots(selectedDate);
                      }
                    }}
                    isSubmitting={walkIn.isSubmitting}
                    selectedPatient={walkIn.selectedPatient}
                    primaryPatient={walkIn.primaryPatient}
                    toast={toast}
                    submitLabel="Proceed to Slot Selection"
                  />
                )}
              </div>
            )}

            {advancedStep === 'slots' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex gap-2 overflow-x-auto scrollbar-none py-1">
                  {nextDates.map((date) => {
                    const isSelected = isSameDay(date, selectedDate);
                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => {
                          setSelectedDate(date);
                          fetchSlots(date);
                        }}
                        className={cn(
                          'flex flex-col items-center justify-center min-w-[60px] p-3 rounded-2xl transition-all',
                          isSelected ? 'bg-primary text-white shadow-lg' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        )}
                      >
                        <span className="text-[9px] font-black uppercase mb-1 opacity-60">{format(date, 'EEE')}</span>
                        <span className="text-base font-black leading-none">{format(date, 'dd')}</span>
                      </button>
                    );
                  })}
                </div>

                {loadingSlots ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning slots...</p>
                  </div>
                ) : !Array.isArray(slots) || slots.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
                    <Calendar className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                    <p className="text-sm font-bold text-slate-400">No availability for this date.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {slots.map((slot) => (
                      <button
                        key={slot.time}
                        disabled={slot.status !== 'available'}
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          'p-4 rounded-2xl border-2 transition-all text-center relative',
                          slot.status !== 'available'
                            ? 'opacity-30 cursor-not-allowed bg-slate-100 border-transparent'
                            : selectedSlot?.time === slot.time
                            ? 'bg-primary border-primary text-white shadow-lg scale-105 z-10'
                            : 'bg-white border-slate-100 hover:border-primary/20 text-slate-600'
                        )}
                      >
                        <span className="text-sm font-black leading-none">{format(new Date(slot.time), 'hh:mm')}</span>
                        <span className="text-[9px] font-bold block opacity-60 uppercase">{format(new Date(slot.time), 'a')}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedSlot && (
                  <div className="fixed bottom-10 left-8 right-8 z-20">
                    <Button
                      onClick={() => setAdvancedStep('confirm')}
                      className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-black/20 flex items-center justify-center gap-2 group"
                    >
                      Next: Review Booking
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {advancedStep === 'confirm' && (
              <div className="space-y-6 animate-in zoom-in-95 duration-500">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <Calendar className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900">Review Appointment</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                      <Clock className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</p>
                        <p className="text-sm font-bold text-slate-800">{format(selectedDate, 'EEEE, d MMMM')}</p>
                        <p className="text-xs font-black text-primary">{format(new Date(selectedSlot.time), 'hh:mm a')}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4">
                      <Hash className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">Reporting Time</p>
                        <p className="text-sm font-bold text-emerald-700">{format(subMinutes(new Date(selectedSlot.time), 15), 'hh:mm a')}</p>
                        <p className="text-[9px] font-bold text-emerald-600/40 uppercase">Arrive 15m early</p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                      <User className="h-5 w-5 text-slate-400" />
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient</p>
                        <p className="text-sm font-bold text-slate-800">{walkIn.selectedPatient?.patientName || walkIn.selectedPatient?.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{walkIn.phoneNumber}</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleAdvancedBook}
                    disabled={isBooking}
                    className="w-full h-16 bg-slate-900 hover:bg-black text-white rounded-[2rem] font-black text-lg gap-3"
                  >
                    {isBooking ? <Loader2 className="h-6 w-6 animate-spin" /> : <><CheckCircle2 className="h-6 w-6" /> Confirm Advanced Booking</>}
                  </Button>
                </div>
              </div>
            )}

            {advancedStep === 'success' && (
              <div className="space-y-8 animate-in zoom-in-95 duration-500 py-4">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900">Booking Confirmed!</h3>
                    <p className="text-slate-500 font-medium">The appointment has been successfully scheduled.</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-[2rem] p-6 space-y-4 border border-slate-100">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient</span>
                    <span className="text-sm font-black text-slate-900">{walkIn.selectedPatient?.patientName || walkIn.selectedPatient?.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Slot Time</span>
                      <span className="text-lg font-black text-slate-900">{format(new Date(selectedSlot.time), 'hh:mm a')}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Reporting Time</span>
                      <span className="text-lg font-black text-emerald-600">{format(subMinutes(new Date(selectedSlot.time), 15), 'hh:mm a')}</span>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Arrive 15 minutes before the slot</p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsBookingDrawerOpen(false)}
                  className="w-full h-16 bg-slate-900 hover:bg-black text-white rounded-[2rem] font-black text-lg"
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </BookingDrawer>

      <AddRelativeDialog
        isOpen={walkIn.isAddRelativeDialogOpen}
        setIsOpen={walkIn.setIsAddRelativeDialogOpen}
        primaryPatientPhone={walkIn.phoneNumber}
        clinicId={data?.clinic?.id || null}
        onRelativeAdded={(newRelative) => {
          walkIn.handlePatientSearch(walkIn.phoneNumber);
          walkIn.selectPatient(newRelative);
        }}
      />
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">{icon}</div>
      <p className="text-sm font-bold text-slate-400">{label}</p>
    </div>
  );
}

function ArrivedPatientList({
  appointments,
  selectedId,
  onSelect,
}: {
  appointments: Appointment[];
  selectedId?: string | null;
  onSelect?: (appt: Appointment) => void;
}) {
  return (
    <div className="space-y-2">
      {appointments.map((appt, idx) => {
        const isSelected = appt.id === selectedId;
        const isInConsultation = appt.status === 'InConsultation';
        return (
          <button
            key={appt.id}
            onClick={() => onSelect?.(appt)}
            className={cn(
              'w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 group',
              isSelected
                ? 'bg-primary/5 border-primary shadow-sm shadow-primary/10'
                : 'bg-white border-slate-100 hover:border-primary/30 hover:bg-slate-50'
            )}
          >
            <div className="flex items-center gap-3">
              {/* Token Badge */}
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0',
                isSelected ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-slate-100 text-slate-600'
              )}>
                {appt.tokenNumber?.split('-')[1] || (idx + 1)}
              </div>

              {/* Patient Info */}
              <div className="flex-1 min-w-0">
                <p className={cn('font-black text-sm truncate leading-none', isSelected ? 'text-primary' : 'text-slate-800')}>
                  {appt.patientName}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  {appt.time && (
                    <span className="text-[10px] font-bold text-slate-400">{appt.time}</span>
                  )}
                  {isInConsultation && (
                    <>
                      {appt.time && <span className="w-1 h-1 rounded-full bg-slate-300" />}
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">In Consult</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status indicator */}
              {isSelected && (
                <Sparkles className="h-4 w-4 text-primary shrink-0 animate-pulse" />
              )}
              {isInConsultation && !isSelected && (
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

