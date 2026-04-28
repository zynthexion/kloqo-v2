'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { Button } from '@/components/ui/button';
import { useNurseBooking } from '@/hooks/useNurseBooking';
import { DateSelection } from '@/components/booking/DateSelection';
import { SlotGrid } from '@/components/booking/SlotGrid';
import { BookingSummaryView } from '@/components/booking/BookingSummaryView';
import { FullScreenLoader } from '../../../components/full-screen-loader';
import ClinicHeader from '@/components/clinic/ClinicHeader';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import { Doctor } from '@kloqo/shared';

function BookAppointmentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const doctorId = searchParams.get('doctor');
  const patientId = searchParams.get('patientId');
  const {
    selectedDate, setSelectedDate,
    slots, loading,
    booking,
    selectedSlot, setSelectedSlot,
    step, setStep,
    patient, doctor,
    fetchingDoctor, dates,
    handleBook, user
  } = useNurseBooking(doctorId, patientId);

  const { data: nurseDashData } = useNurseDashboard(user?.clinicId || '');

  const handleDoctorChange = (id: string) => {
    localStorage.setItem('selectedDoctorId', id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('doctor', id);
    router.replace(`?${params.toString()}`);
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
        <FullScreenLoader isOpen={booking} />
        
        <ClinicHeader 
          doctors={(nurseDashData?.doctors ?? []) as Doctor[]}
          selectedDoctor={doctorId || ''}
          onDoctorChange={handleDoctorChange}
          showLogo={false}
          pageTitle={step === 'selection' ? 'Select Slot' : 'Confirm Booking'}
          showSettings={false}
          onBack={step === 'summary' ? () => setStep('selection') : undefined}
        />

        {step === 'selection' ? (
          <>
            <DateSelection 
              selectedDate={selectedDate} 
              setSelectedDate={setSelectedDate} 
              dates={dates} 
            />

            <main className="flex-1 p-4 space-y-4 overflow-y-auto">
              <SlotGrid 
                loading={loading || fetchingDoctor} 
                slots={slots} 
                selectedSlot={selectedSlot} 
                setSelectedSlot={setSelectedSlot} 
                selectedDate={selectedDate}
                doctor={doctor}
              />
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
          <BookingSummaryView 
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            patient={patient}
            booking={booking}
            handleBook={handleBook}
            onBack={() => setStep('selection')}
            onSuccess={() => router.push('/appointments')}
          />
        )}
      </div>
    </AppFrameLayout>
  );
}

export default function BookAppointmentPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-gray-50 font-pt-sans">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-blue"></div>
        <p className="text-slate-500 font-medium tracking-tight">Loading Booking System...</p>
      </div>
    }>
      <BookAppointmentPageContent />
    </Suspense>
  );
}
