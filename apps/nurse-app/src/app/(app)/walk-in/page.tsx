'use client';

import { Suspense, useEffect, useState } from 'react';
import { Loader2, ArrowLeft, User } from 'lucide-react';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';

// Modular Components
import { useWalkInFlow } from '@/hooks/useWalkInFlow';
import { IdentifyPatientStep } from '@/components/walk-in/IdentifyPatientStep';
import { ConfirmPreviewStep } from '@/components/walk-in/ConfirmPreviewStep';
import { SuccessTokenStep } from '@/components/walk-in/SuccessTokenStep';
import { AddRelativeDialog } from '@/components/patients/AddRelativeDialog';

function WalkInContent() {
  const { toast } = useToast();
  const {
    doctorId, clinicId, currentStep, setCurrentStep, phoneNumber, setPhoneNumber,
    isSearchingPatient, searchedPatients, showRegistrationForm, selectedPatient,
    primaryPatient, isPreviewLoading, walkInPreview, isSubmitting, confirmedAppointment,
    form, handlePatientSearch, selectPatient, onRegistrationSubmit, confirmBooking,
    router, isAddRelativeDialogOpen, setIsAddRelativeDialogOpen
  } = useWalkInFlow();

  const [doctorInfo, setDoctorInfo] = useState<any>(null);

  useEffect(() => {
    const fetchDoctor = async () => {
      if (!doctorId || !clinicId) return;
      try {
        const doctors = await apiRequest<any[]>(`/clinic/doctors?clinicId=${clinicId}`);
        setDoctorInfo(doctors.find(d => d.id === doctorId));
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
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6"><User className="h-10 w-10 text-slate-400" /></div>
          <h2 className="text-2xl font-black text-slate-800">Doctor Not Selected</h2>
          <Button onClick={() => router.push('/')} className="mt-8 rounded-2xl bg-black text-white px-8 h-12">Return to Dashboard</Button>
        </div>
      </AppFrameLayout>
    );
  }

  return (
    <>
      <AppFrameLayout>
        <div className="flex flex-col h-full bg-slate-50 font-pt-sans">
          <header className="flex items-center gap-4 p-4 bg-white border-b sticky top-0 z-20">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => {
              if (currentStep === 'preview') setCurrentStep('identify');
              else if (currentStep === 'confirm') router.push('/');
              else router.back();
            }}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="flex-1">
              <h1 className="text-lg font-black text-slate-900 leading-tight">{currentStep === 'confirm' ? 'Token Generated' : 'Walk-in Registration'}</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                {doctorInfo ? `Dr. ${doctorInfo.name}` : 'Clinic Staff Portal'}
                {doctorInfo && <Badge variant="outline" className="text-[8px] h-3 px-1 border-slate-200">{doctorInfo.specialization}</Badge>}
              </p>
            </div>
          </header>

          <main className="flex-1 p-4 space-y-6 overflow-y-auto">
            {currentStep === 'identify' && (
              <IdentifyPatientStep 
                phoneNumber={phoneNumber} setPhoneNumber={setPhoneNumber}
                isSearchingPatient={isSearchingPatient} searchedPatients={searchedPatients}
                selectedPatient={selectedPatient} selectPatient={selectPatient}
                primaryPatient={primaryPatient} handlePatientSearch={handlePatientSearch}
                setIsAddRelativeDialogOpen={setIsAddRelativeDialogOpen} showRegistrationForm={showRegistrationForm}
                onRegistrationSubmit={onRegistrationSubmit} isSubmitting={isSubmitting}
                form={form} toast={toast} onNext={() => setCurrentStep('preview')}
              />
            )}

            {currentStep === 'preview' && (
              <ConfirmPreviewStep 
                isPreviewLoading={isPreviewLoading} selectedPatient={selectedPatient}
                walkInPreview={walkInPreview} isSubmitting={isSubmitting}
                onConfirm={confirmBooking} onBack={() => setCurrentStep('identify')}
              />
            )}

            {currentStep === 'confirm' && confirmedAppointment && (
              <SuccessTokenStep 
                confirmedAppointment={confirmedAppointment} doctorInfo={doctorInfo}
                onReturn={() => router.push('/')}
                onAnother={() => { setPhoneNumber(''); setCurrentStep('identify'); }}
              />
            )}
          </main>
        </div>
      </AppFrameLayout>

      <AddRelativeDialog 
        isOpen={isAddRelativeDialogOpen} setIsOpen={setIsAddRelativeDialogOpen}
        primaryPatientPhone={phoneNumber} clinicId={clinicId}
        onRelativeAdded={(newRelative) => { handlePatientSearch(phoneNumber); selectPatient(newRelative); }}
      />
    </>
  );
}

export default function WalkInPage() {
  return (
    <Suspense fallback={<div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-slate-50"><Loader2 className="h-12 w-12 animate-spin text-theme-blue" /></div>}>
      <WalkInContent />
    </Suspense>
  );
}
