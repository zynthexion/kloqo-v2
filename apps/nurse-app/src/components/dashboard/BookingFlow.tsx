'use client';

import React from 'react';
import { format, subMinutes, isSameDay } from 'date-fns';
import { 
  User, 
  Hash, 
  Clock, 
  Ticket, 
  CheckCircle2, 
  Loader2, 
  Calendar, 
  ArrowRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BookingDrawer } from './BookingDrawer';
import { PatientSearchBanner } from '@/components/phone-booking/PatientSearchBanner';
import { PatientMatchList } from '@/components/phone-booking/PatientMatchList';
import { PatientRegistrationForm } from '@/components/phone-booking/PatientRegistrationForm';
import { AddRelativeDialog } from '@/components/patients/AddRelativeDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface BookingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  bookingMode: 'walk-in' | 'advanced';
  advancedStep: string;
  setAdvancedStep: (step: any) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  slots: any[];
  selectedSlot: any | null;
  setSelectedSlot: (slot: any) => void;
  loadingSlots: boolean;
  isBooking: boolean;
  walkIn: any;
  handleAdvancedBook: () => Promise<void>;
  nextDates: Date[];
  clinicId?: string;
  fetchSlots: (date: Date) => Promise<void>;
}

export function BookingFlow({
  isOpen,
  onClose,
  bookingMode,
  advancedStep,
  setAdvancedStep,
  selectedDate,
  setSelectedDate,
  slots,
  selectedSlot,
  setSelectedSlot,
  loadingSlots,
  isBooking,
  walkIn,
  handleAdvancedBook,
  nextDates,
  clinicId,
  fetchSlots
}: BookingFlowProps) {
  const { toast } = useToast();

  return (
    <>
      <BookingDrawer
         isOpen={isOpen}
         onClose={onClose}
         title={bookingMode === 'walk-in' ? "Walk-in Registration" : "Advanced Booking"}
         subtitle={bookingMode === 'walk-in' ? "Register patient for immediate queue" : "Schedule patient for future slot"}
      >
         {bookingMode === 'walk-in' ? (
            <div className="space-y-6">
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

                           <div className="border-none shadow-2xl shadow-primary/10 overflow-hidden rounded-[2.5rem] bg-white">
                              <div className="bg-primary p-8 text-white relative overflow-hidden">
                                 <Ticket className="absolute -bottom-6 -right-6 h-40 w-40 text-white/10 rotate-12" />
                                 <div className="relative z-10 space-y-6">
                                    <Badge className="bg-white/20 text-white font-black uppercase text-[10px] tracking-widest">Estimated Token</Badge>
                                    <div className="flex items-end gap-2">
                                       <span className="text-7xl font-black tracking-tighter leading-none">
                                          {walkIn.walkInPreview?.placeholderAssignment?.numericToken || 
                                           (walkIn.walkInPreview?.placeholderAssignment?.tokenNumber?.split('-')[1]) || 
                                           '??'}
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
                              <div className="p-8 space-y-6">
                                 <Button 
                                    onClick={async () => {
                                       const apt = await walkIn.confirmBooking(true);
                                       if (apt) onClose();
                                    }}
                                    disabled={walkIn.isSubmitting}
                                    className="w-full h-16 rounded-[2rem] bg-slate-900 hover:bg-black text-white font-black text-lg shadow-xl shadow-black/20 gap-3"
                                 >
                                    {walkIn.isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <><CheckCircle2 className="h-6 w-6" /> Confirm & Allot Token</>}
                                 </Button>
                              </div>
                           </div>
                        </>
                     )}
                  </div>
               )}
            </div>
         ) : (
            <div className="space-y-6">
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
                          onClick={onClose}
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
        clinicId={clinicId || null}
        onRelativeAdded={(newRelative: any) => {
          walkIn.handlePatientSearch(walkIn.phoneNumber); 
          walkIn.selectPatient(newRelative); 
        }}
      />
    </>
  );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <span className={cn("px-2 py-0.5 text-[10px] font-black rounded-md", className)}>
      {children}
    </span>
  );
}
