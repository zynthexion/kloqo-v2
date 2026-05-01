'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PatientSearchBanner } from '@/components/phone-booking/PatientSearchBanner';
import { PatientMatchList } from '@/components/phone-booking/PatientMatchList';
import { PatientRegistrationForm } from '@/components/phone-booking/PatientRegistrationForm';

interface IdentifyPatientStepProps {
  phoneNumber: string;
  setPhoneNumber: (val: string) => void;
  isSearchingPatient: boolean;
  searchedPatients: any[];
  selectedPatient: any;
  selectPatient: (p: any) => void;
  primaryPatient: any;
  handlePatientSearch: (val: string) => void;
  setIsAddRelativeDialogOpen: (val: boolean) => void;
  showRegistrationForm: boolean;
  onRegistrationSubmit: (data: any) => void;
  isSubmitting: boolean;
  form: any;
  toast: any;
  onNext: () => void;
}

export function IdentifyPatientStep({
  phoneNumber,
  setPhoneNumber,
  isSearchingPatient,
  searchedPatients,
  selectedPatient,
  selectPatient,
  primaryPatient,
  handlePatientSearch,
  setIsAddRelativeDialogOpen,
  showRegistrationForm,
  onRegistrationSubmit,
  isSubmitting,
  form,
  toast,
  onNext
}: IdentifyPatientStepProps) {
  return (
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
            onClick={onNext}
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
  );
}
