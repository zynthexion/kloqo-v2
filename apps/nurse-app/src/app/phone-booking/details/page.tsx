'use client';

import { Suspense } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { Button } from '@/components/ui/button';
import { AddRelativeDialog } from '@/components/patients/AddRelativeDialog';
import { useToast } from '@/hooks/use-toast';

// Refactored Hooks & Components
import { usePhoneBookingDetails } from '@/hooks/use-phone-booking-details';
import { PatientSearchBanner } from '@/components/phone-booking/PatientSearchBanner';
import { PatientMatchList } from '@/components/phone-booking/PatientMatchList';
import { PatientRegistrationForm } from '@/components/phone-booking/PatientRegistrationForm';

function Content() {
  const { toast } = useToast();
  const {
    doctorId,
    clinicId,
    phoneNumber,
    setPhoneNumber,
    isSubmitting,
    isSearchingPatient,
    isSendingLink,
    searchedPatients,
    linkPendingPatients,
    showForm,
    selectedPatient,
    primaryPatient,
    isAddRelativeDialogOpen,
    setIsAddRelativeDialogOpen,
    nextSlotHint,
    form,
    handlePatientSearch,
    selectPatient,
    handleRelativeAdded,
    onSubmit,
    handleSendLink,
    router
  } = usePhoneBookingDetails();

  if (!doctorId) {
    return (
      <AppFrameLayout>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-800">Doctor Not Selected</h2>
          <Button onClick={() => router.push('/')} className="mt-6 rounded-2xl bg-black text-white hover:bg-slate-800">
            Go Back
          </Button>
        </div>
      </AppFrameLayout>
    );
  }

  return (
    <AppFrameLayout>
      <div className="flex flex-col h-full bg-slate-50 font-pt-sans">
        <header className="flex items-center gap-4 p-4 bg-white border-b sticky top-0 z-10">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-black text-slate-900 leading-tight">Phone Booking</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Queue Orchestrator
            </p>
          </div>
        </header>

        <main className="flex-1 p-4 space-y-6 overflow-y-auto">
          <PatientSearchBanner 
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            isSearchingPatient={isSearchingPatient}
            isSendingLink={isSendingLink}
            handleSendLink={handleSendLink}
            nextSlotHint={nextSlotHint}
            onSearch={handlePatientSearch}
          />

          <PatientMatchList 
            phoneNumber={phoneNumber}
            searchedPatients={searchedPatients}
            selectedPatient={selectedPatient}
            onSelectPatient={selectPatient}
            primaryPatient={primaryPatient}
            setIsAddRelativeDialogOpen={setIsAddRelativeDialogOpen}
            linkPendingPatients={linkPendingPatients}
            showForm={showForm}
          />

          {showForm && (
            <PatientRegistrationForm 
              form={form}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
              selectedPatient={selectedPatient}
              primaryPatient={primaryPatient}
              toast={toast}
            />
          )}
        </main>

        <AddRelativeDialog 
          isOpen={isAddRelativeDialogOpen}
          setIsOpen={setIsAddRelativeDialogOpen}
          primaryPatientPhone={primaryPatient?.phone || phoneNumber}
          clinicId={clinicId || ''}
          onRelativeAdded={handleRelativeAdded}
        />
      </div>
    </AppFrameLayout>
  );
}

export default function PhoneBookingDetailsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-slate-50 font-pt-sans">
        <Loader2 className="h-12 w-12 animate-spin text-theme-blue" />
        <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Loading Patient Scanner...</p>
      </div>
    }>
      <Content />
    </Suspense>
  );
}
