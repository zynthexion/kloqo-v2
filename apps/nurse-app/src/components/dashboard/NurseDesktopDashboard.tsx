'use client';

import React, { useState, useMemo } from 'react';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { NurseDesktopHeader } from '../layout/NurseDesktopHeader';
import AppointmentList from '../clinic/AppointmentList';
import { BookingDrawer } from './BookingDrawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  UserPlus, 
  PhoneCall, 
  Calendar, 
  History, 
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  Ticket,
  User,
  Hash,
  Loader2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, isSameDay, subMinutes } from 'date-fns';
import { useWalkInFlow } from '@/hooks/useWalkInFlow';
import { PatientSearchBanner } from '../phone-booking/PatientSearchBanner';
import { PatientMatchList } from '../phone-booking/PatientMatchList';
import { PatientRegistrationForm } from '../phone-booking/PatientRegistrationForm';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { getClinicNow, getClinicISOString, parseClinicDate } from '@kloqo/shared-core';
import { AddRelativeDialog } from '../patients/AddRelativeDialog';

export function NurseDesktopDashboard() {
  const { data, loading, selectedDoctorId, updateAppointmentStatus } = useNurseDashboardContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('arrived');
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false);
  const [bookingMode, setBookingMode] = useState<'walk-in' | 'advanced'>('walk-in');
  const { toast } = useToast();

  // Advanced Booking State
  const [advancedStep, setAdvancedStep] = useState<'identify' | 'slots' | 'confirm' | 'success'>('identify');
  const [selectedDate, setSelectedDate] = useState<Date>(getClinicNow());
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  // Walk-in Flow Hook (with override/bridge to context state)
  const walkIn = useWalkInFlow();
  
  // Bridge the context's selectedDoctorId to the hook's expectation
  // Since useWalkInFlow uses searchParams, we override the core functions to use context
  const handleWalkInOpen = () => {
    setBookingMode('walk-in');
    setIsBookingDrawerOpen(true);
    // Reset walk-in state if needed
    walkIn.setCurrentStep('identify');
  };

  const handleAdvancedOpen = () => {
    setBookingMode('advanced');
    setIsBookingDrawerOpen(true);
    setAdvancedStep('identify');
    
    // Hard Reset identity state for a clean new booking
    walkIn.setPhoneNumber('');
    walkIn.selectPatient(null);
    walkIn.setCurrentStep('identify'); 
  };

  // Advanced Booking Functions
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
    } catch (error) {
      console.error("Error fetching slots:", error);
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
          source: 'Desktop_Hub'
        })
      });
      // Close immediately — SSE will silently refresh the queue
      toast({ title: '✅ Appointment Booked', description: 'Slot locked. Queue will update in real-time.' });
      setIsBookingDrawerOpen(false);
    } catch (error: any) {
      const isConflict = (error as any)?.status === 409;
      toast({
        variant: 'destructive',
        title: isConflict ? 'Slot Already Taken' : 'Booking Failed',
        description: isConflict ? 'Someone just grabbed this slot. Please pick another.' : error.message
      });
    } finally {
      setIsBooking(false);
    }
  };

  const nextDates = useMemo(() => {
    const today = getClinicNow();
    return Array.from({ length: 14 }, (_, i) => addDays(today, i));
  }, []);

  const filteredAppointments = useMemo(() => {
    if (!data?.appointments || !selectedDoctorId) return [];
    let filtered = data.appointments.filter(a => a.doctorId === selectedDoctorId);
    
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.patientName.toLowerCase().includes(lowerSearch) || 
        a.tokenNumber?.toLowerCase().includes(lowerSearch)
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

  const handleUpdateStatus = async (id: string, status: string) => {
    await updateAppointmentStatus(id, status);
  };

  if (loading) {
     return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-muted/10">
           <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Syncing Clinic Data...</p>
        </div>
     );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <NurseDesktopHeader />

      <div className="flex-1 grid grid-cols-12 gap-8 p-8 min-h-0 overflow-hidden">
        {/* Left/Main Column: Queue List */}
        <div className="col-span-8 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-6">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                   placeholder="Search patient name, token or phone..." 
                   className="pl-11 h-12 bg-white/60 border-slate-200/60 rounded-xl focus:ring-primary/20 transition-all font-medium"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>

          <Card className="flex-1 flex flex-col min-h-0 rounded-[2.5rem] border-none shadow-premium bg-white/60 backdrop-blur-md overflow-hidden">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <div className="px-8 pt-6">
                   <TabsList className="bg-slate-100/50 p-1 rounded-2xl h-14 w-full grid grid-cols-2">
                      <TabsTrigger 
                         value="arrived" 
                         className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold flex items-center gap-2"
                      >
                         Arrived <Badge className="bg-emerald-500 text-white rounded-md">{arrivedAppointments.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger 
                         value="pending"
                         className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold flex items-center gap-2"
                      >
                         Pending <Badge className="bg-primary text-white rounded-md">{pendingAppointments.length}</Badge>
                      </TabsTrigger>
                   </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-none">
                   <TabsContent value="arrived" className="m-0 focus-visible:ring-0">
                      <AppointmentList 
                         appointments={arrivedAppointments}
                         onUpdateStatus={handleUpdateStatus}
                         onRejoinQueue={(appt) => { handleUpdateStatus(appt.id, 'Confirmed'); }}
                         showTopRightActions={false}
                         currentTime={new Date()}
                      />
                   </TabsContent>
                   <TabsContent value="pending" className="m-0 focus-visible:ring-0">
                      <AppointmentList 
                         appointments={pendingAppointments}
                         onUpdateStatus={handleUpdateStatus}
                         onAddToQueue={(appt) => { handleUpdateStatus(appt.id, 'Confirmed'); }}
                         showTopRightActions={false}
                         currentTime={new Date()}
                      />
                   </TabsContent>
                </div>
             </Tabs>
          </Card>
        </div>

        {/* Right Column: Actions & Summary */}
        <div className="col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 scrollbar-none">
          {/* Quick Action Buttons */}
          <div className="space-y-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Quick Actions</span>
             
             <Button 
                onClick={handleWalkInOpen}
                className="w-full h-20 bg-primary hover:bg-primary/90 text-white rounded-[2rem] shadow-xl shadow-primary/20 justify-start px-8 gap-4 group transition-all"
             >
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <UserPlus className="h-6 w-6" />
                </div>
                <div className="text-left">
                   <p className="font-bold text-lg">New Walk-in</p>
                   <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Arrive Now</p>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 text-white/40 group-hover:translate-x-1 transition-transform" />
             </Button>

             <Button 
                onClick={handleAdvancedOpen}
                className="w-full h-20 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/60 rounded-[2rem] shadow-xl shadow-slate-200/20 justify-start px-8 gap-4 group transition-all"
             >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                   <PhoneCall className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                   <p className="font-bold text-lg">Book Advanced</p>
                   <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Schedule Next</p>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 text-slate-200 group-hover:translate-x-1 transition-transform" />
             </Button>
          </div>

          {/* Activity Insights */}
          <div className="mt-4 space-y-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Session Health</span>
             <Card className="rounded-[2.5rem] border-none shadow-premium bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white relative overflow-hidden">
                <TrendingUp className="absolute top-[-10%] right-[-5%] w-32 h-32 opacity-10 rotate-12" />
                <div className="relative z-10">
                   <p className="text-white/70 text-xs font-black uppercase tracking-widest">Wait Time Trend</p>
                   <h3 className="text-4xl font-black mt-2">~18m</h3>
                   <div className="flex items-center gap-2 mt-4 bg-white/20 w-fit px-3 py-1 rounded-full text-[10px] font-bold">
                      <Clock className="h-3 w-3" />
                      STABLE CONTEXT
                   </div>
                </div>
             </Card>

             <Card className="rounded-[2.5rem] border-none shadow-premium bg-white/60 backdrop-blur-md p-6">
                <div className="flex items-center justify-between mb-4">
                   <p className="text-slate-900 font-black text-sm uppercase tracking-tight">Today's Goal</p>
                   <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black">72% DONE</span>
                </div>
                <div className="space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-slate-600 font-medium flex-1">Completed Appointments</span>
                      <span className="text-xs font-black text-slate-900">42</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-xs text-slate-600 font-medium flex-1">Upcoming Advanced</span>
                      <span className="text-xs font-black text-slate-900">12</span>
                   </div>
                </div>
             </Card>
          </div>
        </div>
      </div>

      {/* Booking Drawer Integration */}
      <BookingDrawer
         isOpen={isBookingDrawerOpen}
         onClose={() => setIsBookingDrawerOpen(false)}
         title={bookingMode === 'walk-in' ? "Walk-in Registration" : "Advanced Booking"}
         subtitle={bookingMode === 'walk-in' ? "Register patient for immediate queue" : "Schedule patient for future slot"}
      >
         {bookingMode === 'walk-in' ? (
            <div className="space-y-6">
               {/* Step Indicator */}
               {walkIn.currentStep !== 'confirm' && (
                  <div className="flex gap-2 mb-4">
                     <div className={cn("h-1.5 flex-1 rounded-full", walkIn.currentStep === 'identify' ? "bg-primary" : "bg-slate-200")} />
                     <div className={cn("h-1.5 flex-1 rounded-full", walkIn.currentStep === 'preview' ? "bg-primary" : "bg-slate-200")} />
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
                                    <Badge className="bg-white/20 text-white font-black uppercase text-[10px] tracking-widest">Estimated Token</Badge>
                                    <div className="flex items-end gap-2">
                                       <span className="text-7xl font-black tracking-tighter leading-none">
                                          {walkIn.walkInPreview?.placeholderAssignment?.numericToken || '??'}
                                       </span>
                                       <span className="text-2xl font-black opacity-50 mb-1">W</span>
                                    </div>
                                    <div className="pt-4 border-t border-white/20 flex items-center gap-6">
                                       <div className="flex items-center gap-2">
                                          <Clock className="h-4 w-4 opacity-60" />
                                          <span className="text-xs font-bold">{walkIn.walkInPreview?.placeholderAssignment?.slotTime ? format(new Date(walkIn.walkInPreview.placeholderAssignment.slotTime), 'h:mm a') : '...'}</span>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <Hash className="h-4 w-4 opacity-60" />
                                          <span className="text-xs font-bold">Session #{ (walkIn.walkInPreview?.placeholderAssignment?.sessionIndex ?? 0) + 1 }</span>
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
            <div className="space-y-6">
                {/* Advanced Step Indicator */}
                {advancedStep !== 'success' && (
                  <div className="flex gap-2 mb-4">
                     <div className={cn("h-1.5 flex-1 rounded-full", advancedStep === 'identify' ? "bg-primary" : "bg-slate-200")} />
                     <div className={cn("h-1.5 flex-1 rounded-full", advancedStep === 'slots' ? "bg-primary" : "bg-slate-200")} />
                     <div className={cn("h-1.5 flex-1 rounded-full", advancedStep === 'confirm' ? "bg-primary" : "bg-slate-200")} />
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
                           // Select patient but SKIP the automatic walk-in preview transition
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
                      {/* Integrated Horiz Date Picker extracted from book/page.tsx */}
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
                                    "flex flex-col items-center justify-center min-w-[70px] p-3 rounded-2xl transition-all",
                                    isSelected ? "bg-primary text-white shadow-lg" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                                 )}
                              >
                                 <span className="text-[10px] font-black uppercase mb-1 opacity-60">{format(date, 'EEE')}</span>
                                 <span className="text-lg font-black leading-none">{format(date, 'dd')}</span>
                              </button>
                           );
                        })}
                      </div>

                      {loadingSlots ? (
                         <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning slots...</p>
                         </div>
                      ) : !Array.isArray(slots) || slots.length === 0 ? (
                         <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
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
                                     "p-4 rounded-2xl border-2 transition-all text-center relative",
                                     slot.status !== 'available' ? "opacity-30 cursor-not-allowed bg-slate-100 border-transparent" :
                                     selectedSlot?.time === slot.time ? "bg-primary border-primary text-white shadow-lg scale-105 z-10" :
                                     "bg-white border-slate-100 hover:border-primary/20 text-slate-600"
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
             </div>
          )}
      </BookingDrawer>

      <AddRelativeDialog 
        isOpen={walkIn.isAddRelativeDialogOpen}
        setIsOpen={walkIn.setIsAddRelativeDialogOpen}
        primaryPatientPhone={walkIn.phoneNumber}
        clinicId={data?.clinic?.id || null}
        onRelativeAdded={(newRelative) => {
          walkIn.handlePatientSearch(walkIn.phoneNumber); // Refresh list
          walkIn.selectPatient(newRelative); // Automatically select and proceed
        }}
      />
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn("px-2 py-0.5 text-[10px] font-black rounded-md", className)}>
      {children}
    </span>
  );
}
