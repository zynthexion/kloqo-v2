'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Coffee, Trash2, Clock, Calendar as CalendarIcon, Loader2, AlertTriangle, ChevronRight, CheckCircle2, PlusCircle } from "lucide-react";
import { cn, formatTime12Hour } from "@/lib/utils";
import { format, isSameDay, addDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { apiRequest } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Doctor, BreakPeriod } from '@kloqo/shared';

interface NurseScheduleManagerProps {
  doctor: Doctor;
  clinicId: string;
}

export function NurseScheduleManager({ doctor, clinicId }: NurseScheduleManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [breaks, setBreaks] = useState<BreakPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [showAddBreak, setShowAddBreak] = useState(false);

  const fetchDayDetails = useCallback(async () => {
    if (!doctor || !clinicId) return;
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Fetch latest doctor state for breaks
      const docData = await apiRequest<{ doctor: Doctor }>(`/doctors/${doctor.id}`);
      const breakPeriodsRecord = docData.doctor.breakPeriods as Record<string, BreakPeriod[]> || {};
      setBreaks(breakPeriodsRecord[dateStr] || []);

      // Fetch slots for adding new breaks
      const slotDateStr = format(selectedDate, 'yyyy-MM-dd'); // API prefers ISO format
      const response = await apiRequest<any>(
        `/appointments/available-slots?doctorId=${doctor.id}&clinicId=${clinicId}&date=${encodeURIComponent(slotDateStr)}`
      );
      setAvailableSlots(response.slots || []);
    } catch (error: any) {
      console.error("[ScheduleManager] Fetch error:", error);
      toast({ variant: 'destructive', title: 'Fetch Failed', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [doctor, clinicId, selectedDate, toast]);

  useEffect(() => {
    fetchDayDetails();
  }, [fetchDayDetails]);

  const handleDeleteBreak = async (breakId: string) => {
    if (!confirm('Are you sure you want to cancel this break? Appointments might not be automatically shifted back.')) return;
    
    setIsSubmitting(true);
    try {
      await apiRequest('/breaks/cancel', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: doctor.id,
          clinicId,
          breakId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          shouldOpenSlots: true
        })
      });
      toast({ title: 'Break Cancelled', description: 'Action recorded in clinical audit trail.' });
      await fetchDayDetails();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
      {/* 1. Date Context (The "What Day" Panel) */}
      <div className="lg:col-span-4 space-y-4 md:space-y-6">
        <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] md:rounded-[3rem] bg-white p-6 md:p-8">
           <div className="space-y-6">
             <div className="px-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-2">Target Date</p>
               <h3 className="text-xl font-black text-slate-800 tracking-tight">{format(selectedDate, 'EEEE, d MMM yyyy')}</h3>
             </div>
             <Calendar
               mode="single"
               selected={selectedDate}
               onSelect={d => d && setSelectedDate(d)}
               className="w-full"
             />
             <div className="pt-4 flex flex-col gap-2">
                <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clinic Status</p>
                    <p className="text-sm font-bold text-slate-700">Open for Booking</p>
                  </div>
                </div>
             </div>
           </div>
        </Card>
      </div>

      {/* 2. Break Management Panel */}
      <div className="lg:col-span-8 space-y-6 md:space-y-8">
        <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] md:rounded-[3rem] bg-white overflow-hidden">
          <CardHeader className="p-6 md:p-10 border-b border-slate-50 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0 space-y-0">
             <div className="flex items-center gap-4 md:gap-5">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm">
                <Coffee className="h-6 w-6 md:h-7 md:w-7" />
              </div>
              <div>
                <CardTitle className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight">Daily Breaks</CardTitle>
                <CardDescription className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Managing clinical pauses </CardDescription>
              </div>
            </div>
            <Button 
              onClick={() => {
                router.push(`/schedule-break?doctor=${doctor.id}&date=${format(selectedDate, 'yyyy-MM-dd')}`);
              }}
              className="rounded-xl md:rounded-2xl bg-slate-900 font-black uppercase text-[9px] md:text-[10px] tracking-widest text-white px-6 md:px-8 h-12 md:h-14 hover:scale-[1.02] transition-transform flex items-center gap-2"
            >
              <PlusCircle className="w-3.5 h-3.5 md:w-4 h-4" />
              Add New Break
            </Button>
          </CardHeader>
          
          <CardContent className="p-6 md:p-10">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center text-primary/40 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest">Validating clinical state...</p>
              </div>
            ) : breaks.length > 0 ? (
              <div className="space-y-4">
                {breaks.map(b => (
                  <div key={b.id} className="p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] bg-slate-50 border-2 border-slate-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-white hover:border-primary/10 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-primary/5">
                    <div className="flex items-center gap-4 md:gap-6">
                       <div className="h-14 w-14 md:h-16 md:w-16 rounded-xl md:rounded-2xl bg-white shadow-lg flex items-center justify-center border-2 border-slate-50">
                         <div className="p-2.5 md:p-3 rounded-lg md:rounded-xl bg-amber-500/10">
                           <Coffee className="h-6 w-6 md:h-7 md:w-7 text-amber-500" />
                         </div>
                       </div>
                       <div>
                         <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Time Slot</p>
                         <p className="text-lg md:text-xl font-black text-slate-800 tracking-tight">
                            {b.startTime} – {b.endTime}
                         </p>
                       </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-4 md:gap-6">
                      {(b.sessionExtension ?? 0) > 0 && (
                        <div className="bg-emerald-50 px-4 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl border border-emerald-100">
                           <p className="text-[8px] md:text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Auto-Extension</p>
                           <p className="text-xs md:text-sm font-black text-emerald-600 mt-0.5 md:mt-1">+{b.sessionExtension ?? 0} Mins</p>
                        </div>
                      )}
                      <Button 
                        variant="ghost" 
                        onClick={() => handleDeleteBreak(b.id)} 
                        disabled={isSubmitting}
                        className="h-12 w-12 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300"
                      >
                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-24 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100 space-y-4">
                <Coffee className="h-12 w-12 text-slate-200" />
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">Clinical Continuous Flow</p>
                  <p className="text-sm font-bold opacity-40">No breaks scheduled for this date.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tactical Guidance Footer */}
        <div className="p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-primary/5 border-2 border-primary/10 flex flex-col md:flex-row items-center gap-6 md:gap-8 relative overflow-hidden group shadow-sm transition-all hover:bg-primary/10">
           <div className="h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl bg-white flex items-center justify-center border-2 border-primary/20 shrink-0 shadow-lg shadow-primary/5">
             <AlertTriangle className="h-8 w-8 md:h-10 md:w-10 text-primary" />
           </div>
           <div className="space-y-1 md:space-y-2 flex-1 text-center md:text-left">
             <h4 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight leading-none">Accountability Notice</h4>
             <p className="text-xs md:text-sm font-bold text-slate-500 leading-relaxed">
               Modifying breaks shifts consultations in real-time. Disruption is logged under your identity in the clinical audit trail.
             </p>
           </div>
           <Button variant="ghost" className="md:ml-auto h-12 w-12 md:h-16 md:w-16 rounded-xl md:rounded-2xl bg-white/50 text-slate-900 border border-slate-200 hover:bg-primary hover:text-white transition-all px-0">
              <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
           </Button>
        </div>
      </div>
    </div>
  );
}
