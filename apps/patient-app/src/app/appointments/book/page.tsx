'use client';

import { useBookAppointmentState } from '@/hooks/use-book-appointment-state';
import { DateSelector } from '@/components/appointments/booking/DateSelector';
import { SlotGrid } from '@/components/appointments/booking/SlotGrid';
import { BookingSummary } from '@/components/appointments/booking/BookingSummary';
import { Loader2, ArrowLeft, CalendarDays } from 'lucide-react';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';

function BookAppointmentPageContent() {
  const {
    doctor, patient, slots, dates,
    selectedDate, setSelectedDate,
    selectedSlot, setSelectedSlot,
    loading, fetchingDoctor, booking,
    step, setStep,
    handleBook,
    router, doctorId, patientId
  } = useBookAppointmentState();

  if (!doctorId || !patientId) {
    return (
      <AppFrameLayout>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <CalendarDays className="h-10 w-10 text-slate-300" />
          </div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Missing Information</h2>
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
            <DateSelector 
              dates={dates} 
              selectedDate={selectedDate} 
              onSelect={setSelectedDate} 
            />

            <main className="flex-1 p-4 space-y-4 overflow-y-auto">
              {loading || fetchingDoctor ? (
                <div className="flex flex-col items-center justify-center h-48 py-20">
                  <Loader2 className="h-12 w-12 animate-spin text-theme-blue" />
                </div>
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
                  <CalendarDays className="h-12 w-12 text-slate-200" />
                  <p className="text-xs font-black text-slate-400 mt-4 uppercase">No slots available</p>
                </div>
              ) : (
                <SlotGrid 
                  slots={slots} 
                  selectedSlot={selectedSlot} 
                  onSelectSlot={setSelectedSlot} 
                  doctor={doctor} 
                  selectedDate={selectedDate} 
                />
              )}
            </main>

            {selectedSlot && (
              <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t z-50">
                <Button
                  onClick={() => setStep('summary')}
                  className="w-full h-16 rounded-[2rem] bg-theme-blue text-white font-black text-lg"
                >
                  Proceed to Book <ArrowLeft className="h-5 w-5 rotate-180 ml-2" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <BookingSummary 
            selectedDate={selectedDate} 
            selectedSlot={selectedSlot} 
            patient={patient} 
            onBook={handleBook} 
            onBack={() => setStep('selection')} 
            booking={booking} 
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
        <Loader2 className="h-12 w-12 animate-spin text-theme-blue" />
        <p className="text-slate-500 font-medium tracking-tight">Loading Booking System...</p>
      </div>
    }>
      <BookAppointmentPageContent />
    </Suspense>
  );
}
