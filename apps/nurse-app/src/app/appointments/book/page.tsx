'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays, isSameDay, subMinutes, parse, isWithinInterval, isBefore, isAfter } from 'date-fns';
import { Loader2, ArrowLeft, CalendarDays, Clock, CheckCircle2, Phone, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api-client';

import { getClinicNow, parseClinicDate, getClinicISOString } from '@kloqo/shared-core';

import { Suspense } from 'react';

function BookAppointmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const doctorId = searchParams.get('doctor');
  const patientId = searchParams.get('patientId');
  const clinicId = user?.clinicId;

  // Dubai Patient Trap: Initialize with IST time
  const [selectedDate, setSelectedDate] = useState<Date>(getClinicNow());
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [step, setStep] = useState<'selection' | 'summary'>('selection');
  const [patient, setPatient] = useState<any>(null);
  const [doctor, setDoctor] = useState<any>(null);
  const [fetchingDoctor, setFetchingDoctor] = useState(true);

  // Generate days for selection based on doctor's advanceBookingDays
  const dates = useMemo(() => {
    // Principal SRE Catch: Total synchronization with IST baseline
    const nowIst = getClinicNow();
    const todayBaselineIst = parseClinicDate(getClinicISOString(nowIst));
    
    // Standardized logic: advanceBookingDays = Today + N more days (Total N+1 days)
    const advanceBookingDays = doctor?.advanceBookingDays ?? 7;
    
    const allDates = Array.from({ length: advanceBookingDays + 1 }, (_, i) => addDays(todayBaselineIst, i));
    
    if (!doctor || !doctor.availabilitySlots) return allDates;
    
    const availableDays = doctor.availabilitySlots.map((s: any) => {
      if (typeof s.day === 'number') return s.day;
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return dayNames.indexOf(s.day);
    });

    // Also check for dateOverrides
    const overriddenDates = doctor.dateOverrides ? Object.keys(doctor.dateOverrides) : [];

    return allDates
      .filter(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (overriddenDates.includes(dateStr)) {
          const daySlots = doctor.dateOverrides[dateStr];
          return daySlots && daySlots.length > 0;
        }
        return availableDays.includes(date.getDay());
      });
  }, [doctor]);

  // Fetch patient details
  useEffect(() => {
    const fetchPatient = async () => {
      if (!patientId || !clinicId) return;
      try {
      try {
        const data = await apiRequest<any>(
          `/patients/search?id=${patientId}&clinicId=${clinicId}`
        );
        const p = Array.isArray(data) ? data[0] : data;
        setPatient(p);
      } catch (error) {
        console.error("Error fetching patient:", error);
      }
      } catch (error) {
        console.error("Error fetching patient:", error);
      }
    };
    fetchPatient();
  }, [patientId, clinicId]);

  // Fetch doctor details
  useEffect(() => {
    const fetchDoctor = async () => {
      if (!doctorId) return;
      setFetchingDoctor(true);
      try {
      try {
        const data = await apiRequest<any>(`/doctors/${doctorId}`);
        setDoctor(data);
      } catch (error) {
        console.error("Error fetching doctor:", error);
      } finally {
        setFetchingDoctor(false);
      }
      } catch (error) {
        console.error("Error fetching doctor:", error);
      } finally {
        setFetchingDoctor(false);
      }
    };
    fetchDoctor();
  }, [doctorId]);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!doctorId || !clinicId || !selectedDate) return;
      setLoading(true);
      setSelectedSlot(null);
      try {
      try {
        const dateStr = format(selectedDate, 'd MMMM yyyy');
        const data = await apiRequest<any[]>(
          `/appointments/available-slots?doctorId=${doctorId}&clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}`
        );
        setSlots(data);

        // Auto-select first available slot
        const firstAvailable = data.find((s: any) => s.status === 'available');
        if (firstAvailable) {
          setSelectedSlot(firstAvailable);
        }
      } catch (error) {
        console.error("Error fetching slots:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load availability.' });
      } finally {
        setLoading(false);
      }
      } catch (error) {
        console.error("Error fetching slots:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load availability.' });
      } finally {
        setLoading(false);
      }
    };
    fetchSlots();
  }, [doctorId, clinicId, selectedDate, toast]);

  const handleBook = async () => {
    if (!selectedSlot || !patientId || !clinicId || !doctorId) return;
    setBooking(true);
    try {
    try {
      await apiRequest('/appointments/book-advanced', {
        method: 'POST',
        body: JSON.stringify({
          doctorId,
          clinicId,
          patientId,
          date: format(selectedDate, 'd MMMM yyyy'),
          slotTime: format(new Date(selectedSlot.time), 'HH:mm'),
          time: format(new Date(selectedSlot.time), 'HH:mm'),
          slotIndex: selectedSlot.slotIndex,
          sessionIndex: selectedSlot.sessionIndex,
          source: 'Phone'
        })
      });

      toast({ title: 'Success', description: 'Appointment booked successfully.' });
      router.push('/appointments');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setBooking(false);
    }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setBooking(false);
    }
  };

  if (!doctorId || !patientId) {
    return (
      <AppFrameLayout>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <CalendarDays className="h-10 w-10 text-slate-300" />
          </div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Missing Information</h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">We couldn't find the doctor or patient details.</p>
          <Button onClick={() => router.push('/')} className="mt-8 h-12 px-8 rounded-2xl bg-theme-blue font-black">Go Back Home</Button>
        </div>
      </AppFrameLayout>
    );
  }

  return (
    <AppFrameLayout>
      <div className="flex flex-col h-full bg-slate-50">
        <header className="flex items-center gap-4 p-4 bg-white border-b sticky top-0 z-50">
          <Button onClick={() => step === 'summary' ? setStep('selection') : router.back()} variant="ghost" size="icon" className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-slate-900 leading-tight">
              {step === 'selection' ? 'Select Slot' : 'Confirm Booking'}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {step === 'selection' ? 'Step 2: Choose Date & Time' : 'Step 3: Final Review'}
            </p>
          </div>
        </header>

        {step === 'selection' ? (
          <>
            <div className="p-4 bg-white border-b shadow-sm relative z-10">
              <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-theme-blue" />
                  {format(selectedDate, 'MMMM yyyy')}
                </h2>
              </div>
              
              <div className="flex gap-2 pb-2 -mx-1 px-1">
                {dates.map((date, idx) => {
                  const isSelected = isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, getClinicNow());
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(date)}
                      className={cn(
                        "flex flex-col items-center justify-center min-w-[64px] p-4 rounded-3xl transition-all border-2",
                        isSelected 
                          ? "bg-theme-blue border-theme-blue text-white shadow-xl shadow-theme-blue/20 scale-105" 
                          : "bg-slate-50 border-slate-50 text-slate-600 hover:bg-slate-100/80"
                      )}
                    >
                      <span className={cn("text-[10px] font-black uppercase mb-1", isSelected ? "text-blue-100" : "text-slate-400")}>
                        {format(date, 'EEE')}
                      </span>
                      <span className="text-xl font-black leading-none">{format(date, 'dd')}</span>
                      {isToday && (
                        <div className={cn("w-1.5 h-1.5 rounded-full mt-2", isSelected ? "bg-white" : "bg-theme-blue")} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <main className="flex-1 p-4 space-y-4 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-48 py-20">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-theme-blue" />
                    <div className="absolute inset-0 bg-theme-blue/20 blur-xl rounded-full animate-pulse" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-6">Scanning for open slots...</p>
                </div>
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-[2rem] border-2 border-dashed border-slate-100 animate-in fade-in zoom-in-95">
                  <div className="bg-slate-50 p-6 rounded-full mb-4">
                    <CalendarDays className="h-12 w-12 text-slate-200" />
                  </div>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No slots available</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Try a different date above</p>
                </div>
              ) : (
                <div className="space-y-8 pb-32">
                  {(() => {
                    const sessions: Record<number, typeof slots> = {};
                    slots.forEach(slot => {
                      if (!sessions[slot.sessionIndex]) sessions[slot.sessionIndex] = [];
                      sessions[slot.sessionIndex].push(slot);
                    });

                    return Object.entries(sessions).map(([sessionIdx, sessionSlots]) => {
                      const idx = parseInt(sessionIdx);
                      
                      // Calculate Reporting Time Range for Session Header
                      // We use the first slot of the session as startBasis, and the last slot as endBasis
                      const firstSlot = sessionSlots[0];
                      const lastSlot = sessionSlots[sessionSlots.length - 1];
                      const startBasis = new Date(firstSlot.time);
                      const endBasis = new Date(lastSlot.time);
                      
                      const arriveByStart = subMinutes(startBasis, 15);
                      const arriveByEnd = subMinutes(endBasis, 15);

                      // Find breaks for this session
                      const sessionDateStr = format(selectedDate, 'd MMMM yyyy');
                      const doctorBreaks = doctor?.breakPeriods?.[sessionDateStr] || [];
                      const sessionBreaks = doctorBreaks.filter((b: any) => b.sessionIndex === idx);

                      let foundFirstAvailable = false;
                      const visibleSlots = sessionSlots.filter(slot => {
                        if (slot.status === 'available') {
                          if (!foundFirstAvailable) {
                            foundFirstAvailable = true;
                            return true;
                          }
                          return false;
                        }
                        return true;
                      });

                      const isCapacityFull = !sessionSlots.some(s => s.status === 'available');

                      if (visibleSlots.length === 0 && !isCapacityFull) return null;

                      return (
                        <div key={sessionIdx} className="space-y-4">
                          <div className="flex flex-col gap-1 px-2">
                            <div className="flex items-center gap-3">
                              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                Session {idx + 1} 
                                <span className="ml-2 text-slate-300">
                                  ({format(arriveByStart, 'hh:mm a')} - {format(arriveByEnd, 'hh:mm a')})
                                </span>
                              </h3>
                              <div className="flex-1 h-[1px] bg-slate-100" />
                              {isCapacityFull && (
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Capacity Full
                                </span>
                              )}
                            </div>
                            {sessionBreaks.length > 0 && (
                              <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                                [Break: {sessionBreaks.map((b: any) => `${b.startTimeFormatted} - ${b.endTimeFormatted}`).join(', ')}]
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {visibleSlots.map((slot, idx) => {
                              const isBooked = slot.status !== 'available';
                              const isSelected = selectedSlot?.time === slot.time;
                              const slotTime = new Date(slot.time);
                              const displayTime = slot.status === 'available' ? subMinutes(slotTime, 15) : slotTime;

                              return (
                                <button
                                  key={idx}
                                  disabled={isBooked}
                                  onClick={() => setSelectedSlot(slot)}
                                  className={cn(
                                    "relative p-5 rounded-[2rem] border-2 transition-all text-left overflow-hidden group",
                                    isBooked 
                                      ? "bg-slate-50 border-slate-50 grayscale opacity-40 cursor-not-allowed" 
                                      : isSelected
                                        ? "bg-theme-blue border-theme-blue text-white shadow-2xl shadow-theme-blue/30 scale-105 z-10"
                                        : "bg-white border-slate-50 hover:border-theme-blue/30 shadow-sm"
                                  )}
                                >
                                  <div className="flex justify-between items-start mb-3">
                                    <div className={cn(
                                      "p-2 rounded-xl transition-colors",
                                      isSelected ? "bg-white/20" : "bg-slate-50 group-hover:bg-theme-blue/5"
                                    )}>
                                      <Clock className={cn("h-4 w-4", isSelected ? "text-white" : "text-slate-400 group-hover:text-theme-blue")} />
                                    </div>
                                    {isSelected && <CheckCircle2 className="h-6 w-6 text-white animate-in zoom-in-50" />}
                                  </div>
                                  
                                  <p className="text-2xl font-black leading-none tracking-tight mb-1">
                                    {slot.status === 'booked' && slot.tokenNumber ? (
                                      <span className="text-theme-blue">{slot.tokenNumber}</span>
                                    ) : (
                                      <>
                                        {format(displayTime, 'hh:mm')}
                                        <span className="text-xs ml-1 opacity-70 uppercase">{format(displayTime, 'a')}</span>
                                      </>
                                    )}
                                  </p>
                                  
                                  <p className={cn(
                                    "text-[10px] font-black uppercase tracking-widest",
                                    isSelected ? "text-blue-100" : "text-slate-400"
                                  )}>
                                    {slot.status === 'booked' ? 'Booked' : 
                                     slot.status === 'reserved' ? 'Reserved' :
                                     slot.status === 'leave' ? 'On Leave' : 
                                     slot.status === 'past' ? 'Past' : 'Available'}
                                  </p>
                                  
                                  {slot.status === 'available' && (
                                    <div className={cn(
                                      "mt-4 pt-3 border-t",
                                      isSelected ? "border-white/10" : "border-slate-50"
                                    )}>
                                      <p className={cn(
                                        "text-[9px] font-black uppercase tracking-widest leading-none",
                                        isSelected ? "text-white/50" : "text-slate-300"
                                      )}>Reporting</p>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </main>

            {selectedSlot && (
              <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t z-50 animate-in slide-in-from-bottom-full duration-500">
                <Button
                  onClick={() => setStep('summary')}
                  className="w-full h-16 rounded-[2rem] bg-theme-blue hover:bg-theme-blue/90 text-white font-black text-lg shadow-2xl shadow-theme-blue/30 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <span>Proceed to Book</span>
                  <ArrowLeft className="h-5 w-5 rotate-180" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <main className="flex-1 p-6 space-y-6 overflow-y-auto animate-in fade-in slide-in-from-right-4">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-theme-blue/5 rounded-full -mr-20 -mt-20 blur-3xl" />
              
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-5 bg-theme-blue/10 rounded-[2rem] text-theme-blue">
                  <Clock className="h-10 w-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">Review Details</h2>
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Please confirm the slot</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 transition-colors hover:bg-slate-100/50">
                  <div className="p-3 bg-white rounded-2xl shadow-sm">
                    <CalendarDays className="h-5 w-5 text-theme-blue" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Date & Time</label>
                    <p className="text-base font-black text-slate-900">
                      {format(selectedDate, 'EEEE, d MMMM')}
                    </p>
                    <p className="text-sm font-bold text-theme-blue">
                      {format(new Date(selectedSlot.time), 'hh:mm a')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 transition-colors hover:bg-slate-100/50">
                  <div className="p-3 bg-white rounded-2xl shadow-sm">
                    <Clock className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest block mb-0.5">Reporting Time</label>
                    <p className="text-base font-black text-emerald-600">
                      {format(subMinutes(new Date(selectedSlot.time), 15), 'hh:mm a')}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-600/50 uppercase">Please arrive 15m early</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 transition-colors hover:bg-slate-100/50">
                  <div className="p-3 bg-white rounded-2xl shadow-sm">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Patient Details</label>
                    <p className="text-base font-black text-slate-900 leading-tight">
                      {patient?.name || 'Loading...'}
                    </p>
                    <p className="text-xs font-bold text-slate-500">{patient?.phone?.replace('+91', '') || 'No number'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center px-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Consultation</span>
                  <span className="text-sm font-black text-slate-900">Advanced Booking</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <Button
                onClick={handleBook}
                disabled={booking}
                className="w-full h-16 rounded-[2rem] bg-theme-blue hover:bg-theme-blue/90 text-white font-black text-xl shadow-2xl shadow-theme-blue/20 transition-all active:scale-95"
              >
                {booking ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Confirm Appointment'}
              </Button>
              <Button
                onClick={() => setStep('selection')}
                variant="ghost"
                className="w-full h-12 rounded-2xl text-slate-400 font-black uppercase tracking-widest text-xs hover:bg-slate-100"
              >
                Change Date or Slot
              </Button>
            </div>
          </main>
        )}
      </div>
    </AppFrameLayout>
  );
}

export default function BookAppointmentPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-gray-50 font-pt-sans">
        <Loader2 className="h-12 w-12 animate-spin text-theme-blue" />
        <p className="text-slate-500 font-medium tracking-tight">Loading Booking System...</p>
      </div>
    }>
      <BookAppointmentPageContent />
    </Suspense>
  );
}
