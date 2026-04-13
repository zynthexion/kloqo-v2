'use client';

import { Suspense } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useBookingDetailsState } from '@/hooks/use-booking-details-state';
import { DoctorHeader } from '@/components/appointments/booking/DoctorHeader';
import { SlotInfo } from '@/components/appointments/booking/SlotInfo';
import { PatientForm } from '@/components/patient-form';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/language-context';

export const dynamic = 'force-dynamic';

function AppointmentDetailsContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const { doctor, selectedSlot, loading } = useBookingDetailsState();

  if (!selectedSlot) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-[3rem] mt-8 mx-4 border-2 border-dashed border-slate-100 animate-in fade-in duration-500">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Session Expired</h2>
        <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Please restart the booking from Home</p>
        <Button onClick={() => router.push('/')} variant="ghost" className="mt-8 font-black uppercase text-xs tracking-widest text-theme-blue">Reset Flow</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="border-none shadow-2xl shadow-black/5 rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-xl border border-white/20">
        <CardContent className="p-8 space-y-6">
          <DoctorHeader doctor={doctor} loading={loading} />
          <SlotInfo doctor={doctor} selectedSlot={selectedSlot} loading={loading} />
        </CardContent>
      </Card>
      
      {doctor && (
        <PatientForm
          selectedDoctor={doctor}
          appointmentType="Online"
          renderLoadingOverlay={(isLoading) => <FullScreenLoader isOpen={isLoading} />}
        />
      )}
    </div>
  );
}

function BookingDetailsPage() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 font-pt-sans">
      <header className="flex items-center p-6 border-b bg-white sticky top-0 z-50">
        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-slate-50 hover:bg-slate-100" onClick={() => router.back()}>
          <ArrowLeft className="h-6 w-6 text-slate-600" />
          <span className="sr-only">Back</span>
        </Button>
        <div className="flex-1 text-center">
            <h1 className="text-lg font-black text-slate-900 leading-none uppercase tracking-tight">{t.bookAppointment.patientDetails}</h1>
            <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest leading-none">Step 4: Final Details</p>
        </div>
        <div className="w-12"></div>
      </header>
      
      <main className="flex-grow overflow-y-auto p-4 md:p-8 space-y-8">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center p-24">
            <Loader2 className="h-10 w-10 animate-spin text-theme-blue/30" />
          </div>
        }>
          <AppointmentDetailsContent />
        </Suspense>
      </main>
    </div>
  );
}

export default function BookingDetailsPageWithAuth() {
  return (
    <AuthGuard>
      <BookingDetailsPage />
    </AuthGuard>
  );
}
