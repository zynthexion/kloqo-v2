'use client';

import { Suspense, useEffect, useState } from 'react';
import { Loader2, ArrowLeft, CheckCircle2, Ticket, Clock, User, Phone, MapPin, Hash } from 'lucide-react';
import Link from 'next/link';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/api-client';

// Refactored Hooks & Components
import { useWalkInFlow } from '@/hooks/useWalkInFlow';
import { PatientSearchBanner } from '@/components/phone-booking/PatientSearchBanner';
import { PatientMatchList } from '@/components/phone-booking/PatientMatchList';
import { PatientRegistrationForm } from '@/components/phone-booking/PatientRegistrationForm';
import { AddRelativeDialog } from '@/components/patients/AddRelativeDialog';

function WalkInContent() {
  const { toast } = useToast();
  const {
    doctorId,
    clinicId,
    currentStep,
    setCurrentStep,
    phoneNumber,
    setPhoneNumber,
    isSearchingPatient,
    searchedPatients,
    showRegistrationForm,
    selectedPatient,
    primaryPatient,
    isPreviewLoading,
    walkInPreview,
    isSubmitting,
    confirmedAppointment,
    form,
    handlePatientSearch,
    selectPatient,
    onRegistrationSubmit,
    confirmBooking,
    router,
    isAddRelativeDialogOpen,
    setIsAddRelativeDialogOpen
  } = useWalkInFlow();

  const [doctorInfo, setDoctorInfo] = useState<any>(null);

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!doctorId || !clinicId) return;
      try {
        const doctors = await apiRequest<any[]>(`/clinic/doctors?clinicId=${clinicId}`);
        const doc = doctors.find(d => d.id === doctorId);
        setDoctorInfo(doc);
      } catch (error) {
        console.error("Error fetching doctor:", error);
      }
    };
    fetchDoctor();
  }, [doctorId, clinicId]);

  if (!doctorId) {
    return (
      <AppFrameLayout>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <User className="h-10 w-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Doctor Not Selected</h2>
          <p className="text-slate-500 mt-2 max-w-xs">Please select a doctor from the dashboard to proceed with walk-in registration.</p>
          <Button onClick={() => router.push('/')} className="mt-8 rounded-2xl bg-black text-white hover:bg-slate-800 px-8 h-12">
            Return to Dashboard
          </Button>
        </div>
      </AppFrameLayout>
    );
  }

  return (
    <>
      <AppFrameLayout>
        <div className="flex flex-col h-full bg-slate-50 font-pt-sans">
          {/* Header */}
          <header className="flex items-center gap-4 p-4 bg-white border-b sticky top-0 z-20">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-xl"
              onClick={() => {
                if (currentStep === 'preview') setCurrentStep('identify');
                else if (currentStep === 'confirm') router.push('/');
                else router.back();
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-black text-slate-900 leading-tight">
                {currentStep === 'confirm' ? 'Token Generated' : 'Walk-in Registration'}
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group flex items-center gap-1">
                {doctorInfo ? `Dr. ${doctorInfo.name}` : 'Clinic Staff Portal'}
                {doctorInfo && <Badge variant="outline" className="text-[8px] h-3 px-1 border-slate-200">{doctorInfo.specialization}</Badge>}
              </p>
            </div>
            {currentStep !== 'confirm' && (
              <div className="flex gap-1">
                <div className={`h-1.5 w-4 rounded-full ${currentStep === 'identify' ? 'bg-theme-blue' : 'bg-slate-200'}`} />
                <div className={`h-1.5 w-4 rounded-full ${currentStep === 'preview' ? 'bg-theme-blue' : 'bg-slate-200'}`} />
              </div>
            )}
          </header>

          <main className="flex-1 p-4 space-y-6 overflow-y-auto">
            {/* STEP 1: IDENTIFY */}
            {currentStep === 'identify' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PatientSearchBanner 
                  phoneNumber={phoneNumber}
                  setPhoneNumber={setPhoneNumber}
                  isSearchingPatient={isSearchingPatient}
                  isSendingLink={false}
                  handleSendLink={() => {}}
                  onSearch={handlePatientSearch}
                />

                <PatientMatchList 
                  phoneNumber={phoneNumber}
                  searchedPatients={searchedPatients}
                  selectedPatient={selectedPatient}
                  onSelectPatient={selectPatient}
                  primaryPatient={primaryPatient}
                  setIsAddRelativeDialogOpen={setIsAddRelativeDialogOpen}
                  linkPendingPatients={[]}
                  showForm={showRegistrationForm}
                />

                {selectedPatient && !showRegistrationForm && (
                  <div className="pt-4 animate-in fade-in slide-in-from-bottom-4">
                    <Button 
                      onClick={() => setCurrentStep('preview')}
                      className="w-full h-16 rounded-[2rem] bg-theme-blue text-white font-black shadow-xl shadow-theme-blue/20 flex items-center justify-center gap-2 group"
                    >
                      Proceed to Token Preview
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                )}

                {showRegistrationForm && (
                  <PatientRegistrationForm 
                    form={form}
                    onSubmit={onRegistrationSubmit}
                    isSubmitting={isSubmitting}
                    selectedPatient={selectedPatient}
                    primaryPatient={primaryPatient}
                    toast={toast}
                    submitLabel="Generate Walk-in Preview"
                  />
                )}
              </div>
            )}

            {/* STEP 2: PREVIEW */}
            {currentStep === 'preview' && (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                {isPreviewLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-theme-blue" />
                    <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Calculating Token Estimate...</p>
                  </div>
                ) : (
                  <>
                    {/* Patient Info Summary */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                          <User className="h-6 w-6 text-slate-400" />
                        </div>
                        <div>
                          <h2 className="font-black text-slate-800 leading-none">
                            {selectedPatient?.patientName || selectedPatient?.name}
                          </h2>
                          <p className="text-xs font-bold text-slate-400 mt-1">
                            {selectedPatient?.sex}, {selectedPatient?.age} Years
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setCurrentStep('identify')} className="text-theme-blue font-black text-[10px] uppercase">
                        Change
                      </Button>
                    </div>

                    {/* Token Preview Card */}
                    <Card className="border-none shadow-xl shadow-theme-blue/10 overflow-hidden rounded-[40px] bg-white">
                      <div className="bg-theme-blue p-8 text-white relative overflow-hidden">
                        {/* Decorative Background Icon */}
                        <Ticket className="absolute -bottom-6 -right-6 h-40 w-40 text-white/10 rotate-12" />
                        
                        <div className="relative z-10 space-y-6">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-white/20 text-white border-white/20 px-3 py-1 font-black uppercase text-[10px] tracking-widest">
                              Estimated Token
                            </Badge>
                          </div>
                          
                          <div className="flex items-end gap-2">
                            <span className="text-7xl font-black tracking-tighter leading-none">
                              {walkInPreview?.placeholderAssignment?.numericToken || '??'}
                            </span>
                            <span className="text-2xl font-black opacity-50 mb-1">W</span>
                          </div>

                          <div className="pt-4 border-t border-white/20 flex items-center gap-6">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 opacity-60" />
                              <span className="text-xs font-bold">
                                {walkInPreview?.placeholderAssignment?.slotTime 
                                  ? new Date(walkInPreview.placeholderAssignment.slotTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                                  : 'Calculating...'
                                }
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 opacity-60" />
                              <span className="text-xs font-bold">Session #{ (walkInPreview?.placeholderAssignment?.sessionIndex ?? 0) + 1 }</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <CardContent className="p-8 space-y-6">
                        <div className="space-y-4">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Queue Status</h3>
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <span className="text-xs font-bold text-slate-600">Clinical Wait Time</span>
                              <span className="text-xs font-black text-slate-900">~ 20-30 Mins</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <span className="text-xs font-bold text-slate-600">Token Type</span>
                              <span className="text-xs font-black text-theme-blue">Walk-in (General)</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
                          <p className="text-[10px] leading-relaxed text-amber-700 font-bold">
                            Note: This is an estimated token number based on the current queue. The actual token number will be assigned upon final confirmation.
                          </p>
                        </div>

                        <Button 
                          onClick={() => confirmBooking()}
                          disabled={isSubmitting}
                          className="w-full h-16 rounded-3xl bg-black hover:bg-slate-900 text-white font-black text-lg shadow-xl shadow-black/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-6 w-6" />
                              <span>Confirm & Allot Token</span>
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* STEP 3: CONFIRM */}
            {currentStep === 'confirm' && confirmedAppointment && (
              <div className="space-y-8 py-10 animate-in fade-in zoom-in-95 duration-700">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center border-4 border-white shadow-xl shadow-green-100">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                  </div>
                  <h2 className="text-3xl font-black text-slate-900">Success!</h2>
                  <p className="text-slate-500 font-bold max-w-[240px]">Token successfully generated for the patient.</p>
                </div>

                {/* Physical Token Card Design */}
                <div className="mx-auto max-w-[280px] bg-white rounded-[40px] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden p-8 flex flex-col items-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Official Token</p>
                  <div className="w-full h-px bg-slate-100 mb-6" />
                  
                  <h3 className="text-[10px] font-black text-theme-blue uppercase tracking-widest mb-1">
                    Dr. {doctorInfo?.name}
                  </h3>
                  
                  <div className="flex items-end gap-1 my-6">
                    <span className="text-8xl font-black tracking-tighter text-slate-900">
                      {confirmedAppointment.numericToken}
                    </span>
                    <span className="text-3xl font-black text-slate-300 mb-2">W</span>
                  </div>

                  <div className="w-full space-y-3 pt-6 border-t border-slate-100">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-400 uppercase tracking-widest">Patient</span>
                      <span className="text-slate-900 truncate max-w-[120px]">{confirmedAppointment.patientName}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-400 uppercase tracking-widest">Time</span>
                      <span className="text-slate-900 uppercase">{confirmedAppointment.time}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-400 uppercase tracking-widest">Date</span>
                      <span className="text-slate-900">{confirmedAppointment.date}</span>
                    </div>
                  </div>

                  <div className="mt-8 flex gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                  </div>
                </div>

                <div className="space-y-3 px-4">
                  <Button 
                    onClick={() => router.push('/')}
                    className="w-full h-14 rounded-3xl bg-black text-white font-black shadow-xl"
                  >
                    Return to Dashboard
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => {
                      setPhoneNumber('');
                      setCurrentStep('identify');
                    }}
                    className="w-full h-14 rounded-3xl text-slate-400 font-black text-xs uppercase tracking-widest"
                  >
                    Register Another Walk-in
                  </Button>
                </div>
              </div>
            )}
          </main>
        </div>
      </AppFrameLayout>

      <AddRelativeDialog 
        isOpen={isAddRelativeDialogOpen}
        setIsOpen={setIsAddRelativeDialogOpen}
        primaryPatientPhone={phoneNumber}
        clinicId={clinicId}
        onRelativeAdded={(newRelative) => {
          handlePatientSearch(phoneNumber);
          selectPatient(newRelative);
        }}
      />
    </>
  );
}

export default function WalkInPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-slate-50 font-pt-sans">
        <Loader2 className="h-12 w-12 animate-spin text-theme-blue" />
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Preparing Walk-in Engine...</p>
      </div>
    }>
      <WalkInContent />
    </Suspense>
  );
}
