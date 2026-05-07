'use client';

import React, { useState, useMemo } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  User, 
  Phone,
  RefreshCw,
  XCircle,
  Search,
  Bell,
  Calendar
} from 'lucide-react';
import { Appointment } from '@kloqo/shared';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BookingFlow } from '@/components/dashboard/BookingFlow';
import { useDashboardBooking } from '@/hooks/useDashboardBooking';
import { useConflictTriage } from '@/hooks/useConflictTriage';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { NurseDesktopShell } from '@/components/layout/NurseDesktopShell';
import AppFrameLayout from '@/components/layout/AppFrameLayout';

export default function ConflictCenterPage() {
  const { user } = useAuth();
  const { conflicts, loading, resolveConflict, refresh } = useConflictTriage();
  const [searchQuery, setSearchQuery] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { activeRole } = useActiveIdentity();

  const filteredConflicts = useMemo(() => {
    return conflicts.filter(c => 
      c.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tokenNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.doctorName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conflicts, searchQuery]);

  const selectedConflict = useMemo(() => 
    conflicts.find(c => c.id === selectedId),
    [conflicts, selectedId]
  );

  const booking = useDashboardBooking(
    selectedConflict?.doctorId || '', 
    user?.clinicId
  );

  const handleResolve = async (id: string, action: 'CONFIRM' | 'RESCHEDULE' | 'CANCEL', payload: any = {}) => {
    setResolvingId(id);
    try {
      await resolveConflict(id, action, payload);
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      console.error("Resolve failed", e);
    } finally {
      setResolvingId(null);
    }
  };

  const handleRescheduleConfirm = async () => {
    if (!selectedId || !booking.selectedSlot) return;
    
    // Use 'RESCHEDULE' (not 'CONFIRM') so the backend sets isRescheduled:true
    // and routes the patient through the correct notification path.
    await handleResolve(selectedId, 'RESCHEDULE', {
      newDate: format(booking.selectedDate, 'yyyy-MM-dd'),
      newTime: format(new Date(booking.selectedSlot.time), 'HH:mm'),
      newSlotIndex: booking.selectedSlot.slotIndex,
      newSessionIndex: booking.selectedSlot.sessionIndex
    });
    
    booking.setAdvancedStep('success');
  };

  const content = (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200/60 sticky top-0 z-30 px-6 py-6 backdrop-blur-md bg-white/80">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-amber-50 rounded-xl">
                <AlertCircle className="w-6 h-6 text-amber-500" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Action Center</h1>
            </div>
            <p className="text-slate-500 text-sm font-medium">
              Manage schedule overrides and patient relocations
            </p>
          </div>

          <div className="flex items-center gap-4">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search patients..." 
                  className="pl-10 w-64 bg-slate-100 border-none rounded-xl focus-visible:ring-primary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
             <Button variant="outline" size="icon" onClick={refresh} className="rounded-xl border-slate-200">
               <RefreshCw className={cn("w-4 h-4 text-slate-600", loading && "animate-spin")} />
             </Button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* Statistics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm flex items-center gap-5 group hover:border-primary/20 transition-all cursor-default">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bell className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">Total Conflicts</p>
              <p className="text-3xl font-black text-slate-800">{conflicts.length}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm flex items-center gap-5 group hover:border-emerald-500/20 transition-all cursor-default">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">High Impact</p>
              <p className="text-3xl font-black text-slate-800">
                {conflicts.filter(c => c.bookedVia === 'Advanced Booking').length}
              </p>
            </div>
          </div>

          <div className={cn(
            "p-6 rounded-3xl shadow-xl transition-all duration-500 flex items-center gap-5 group cursor-default sm:col-span-2 lg:col-span-1",
            selectedConflict ? "bg-emerald-600 shadow-emerald-500/20" : "bg-primary shadow-primary/20"
          )}>
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-[10px] font-black uppercase tracking-wider mb-1">
                {selectedConflict ? `For ${selectedConflict.patientName}` : 'Next Best Slot'}
              </p>
              <p className="text-2xl font-black text-white">
                {selectedConflict?.suggestedSlot?.time || 'Dynamic Triage'}
              </p>
            </div>
          </div>
        </div>

        {/* Conflict List */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-12 h-12 text-slate-200 animate-spin mx-auto mb-4" />
              <p className="text-slate-400 font-medium tracking-tight">Syncing conflicts...</p>
            </div>
          ) : filteredConflicts.length === 0 ? (
            <div className="py-32 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Zero Conflicts</h3>
              <p className="text-slate-400 max-w-xs mx-auto">
                Everything is running smoothly. All schedule overrides have been resolved.
              </p>
            </div>
          ) : (
            filteredConflicts.map((conflict) => (
              <Card 
                key={conflict.id} 
                onClick={() => setSelectedId(conflict.id)}
                className={cn(
                  "border-2 shadow-sm rounded-[32px] overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 cursor-pointer",
                  selectedId === conflict.id ? "border-emerald-500 ring-4 ring-emerald-500/10" : "border-transparent"
                )}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row items-stretch">
                    {/* Patient Info Card */}
                    <div className="md:w-1/3 bg-slate-50/50 p-8 border-r border-slate-100 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4">
                         <Badge variant="outline" className="bg-white border-slate-200 text-slate-500 text-[10px] font-bold uppercase">
                           {conflict.tokenNumber}
                         </Badge>
                      </div>

                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-slate-100 group-hover:scale-105 transition-transform">
                          <User className="w-8 h-8 text-slate-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                            {conflict.patientName}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                             <Phone className="w-3 h-3 text-primary" />
                             <span className="text-primary font-bold text-sm tracking-tight">{conflict.communicationPhone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-slate-500">
                           <div className="p-1.5 bg-white rounded-lg border border-slate-100">
                             <Calendar className="w-3.5 h-3.5" />
                           </div>
                           <span className="text-sm font-semibold tracking-tight">{conflict.date}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-500">
                           <div className="p-1.5 bg-white rounded-lg border border-slate-100">
                             <Clock className="w-3.5 h-3.5" />
                           </div>
                           <span className="text-sm font-semibold tracking-tight">Original: {conflict.time}</span>
                        </div>
                      </div>
                    </div>

                    {/* Triage Actions */}
                     <div className="flex-1 p-8 bg-white flex flex-col justify-center">
                       <div className="flex flex-wrap items-center gap-4 mb-8">
                         <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-3">
                           <AlertCircle className="w-5 h-5 text-amber-500" />
                           <p className="text-sm font-bold text-amber-700 tracking-tight">
                             Requires immediate triage due to schedule override.
                           </p>
                         </div>
                       </div>

                       <div className="flex items-center gap-3">
                         <Button 
                          onClick={() => handleResolve(conflict.id, 'CONFIRM', { 
                            newDate: conflict.suggestedSlot?.date || conflict.date, 
                            newTime: conflict.suggestedSlot?.time,
                            newSlotIndex: conflict.suggestedSlot?.slotIndex,
                            newSessionIndex: conflict.suggestedSlot?.sessionIndex
                          })}
                          disabled={resolvingId === conflict.id || !conflict.suggestedSlot}
                          className="rounded-2xl h-14 px-8 bg-primary hover:bg-primary-dark shadow-lg shadow-primary/20 flex-1 md:flex-none font-bold text-base"
                         >
                           {resolvingId === conflict.id ? <RefreshCw className="animate-spin" /> : "Confirm New Slot"}
                         </Button>
                         
                         <Button 
                          variant="outline"
                          onClick={() => {
                            setSelectedId(conflict.id);
                            booking.startReschedule(conflict);
                          }}
                          disabled={resolvingId === conflict.id}
                          className="rounded-2xl h-14 px-8 border-slate-200 font-bold text-slate-600 hover:bg-slate-50 flex-1 md:flex-none"
                         >
                           Another Day
                         </Button>

                         <Button 
                          variant="ghost"
                          onClick={() => handleResolve(conflict.id, 'CANCEL')}
                          disabled={resolvingId === conflict.id}
                          className="rounded-2xl h-14 px-8 text-rose-500 hover:bg-rose-50 font-bold flex-1 md:flex-none"
                         >
                           <XCircle className="w-5 h-5 mr-2" />
                           Cancel
                         </Button>
                       </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>

      <BookingFlow
        isOpen={booking.isBookingDrawerOpen}
        onClose={() => booking.setIsBookingDrawerOpen(false)}
        bookingMode={booking.bookingMode}
        advancedStep={booking.advancedStep}
        setAdvancedStep={booking.setAdvancedStep}
        selectedDate={booking.selectedDate}
        setSelectedDate={booking.setSelectedDate}
        slots={booking.slots}
        selectedSlot={booking.selectedSlot}
        setSelectedSlot={booking.setSelectedSlot}
        loadingSlots={booking.loadingSlots}
        isBooking={booking.isBooking || resolvingId === selectedId}
        walkIn={booking.walkIn}
        handleAdvancedBook={handleRescheduleConfirm}
        nextDates={booking.nextDates}
        clinicId={user?.clinicId}
        fetchSlots={booking.fetchSlots}
      />
    </div>
  );

  return (
    <ResponsiveAppLayout 
      mobile={<AppFrameLayout showBottomNav={true}>{content}</AppFrameLayout>} 
      tablet={
        activeRole === 'nurse' ? (
          <NurseDesktopShell>
            {content}
          </NurseDesktopShell>
        ) : (
          <AppFrameLayout>{content}</AppFrameLayout>
        )
      } 
    />
  );
}
