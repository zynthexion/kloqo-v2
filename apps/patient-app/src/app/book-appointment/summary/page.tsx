'use client';

import { Suspense } from 'react';
import { useBookingSummaryState } from '@/hooks/use-booking-summary-state';
import { DoctorInfoCard, PatientInfoCard } from '@/components/booking-summary/InfoCards';
import { BookingSuccess } from '@/components/booking-summary/BookingSuccess';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { useMasterDepartments } from '@/hooks/use-master-departments';

/**
 * BookingSummary Orchestrator
 * Modularized booking flow featuring multi-step confirmation, success state management,
 * and localized summaries.
 */
function BookingSummaryContent() {
    const {
        doctor, patient, clinicData, selectedSlot, loading,
        isSubmitting, status, bookingDetails, handleConfirmBooking,
        isPulsating,
        t, language, router, isWalkIn, user
    } = useBookingSummaryState();

    const { departments } = useMasterDepartments();

    if (status === 'success') {
        return <BookingSuccess details={bookingDetails} t={t} isWalkIn={isWalkIn} clinicData={clinicData} />;
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-background font-body">
            <FullScreenLoader isOpen={isSubmitting} />
            
            <header className="flex items-center p-4 border-b">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-bold text-center flex-grow">{t.bookAppointment.bookingSummary}</h1>
                <div className="w-8"></div>
            </header>

            <main className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6">
                <DoctorInfoCard 
                    doctor={doctor} 
                    selectedSlot={selectedSlot} 
                    language={language} 
                    departments={departments} 
                    t={t} 
                    isPulsating={isPulsating}
                />
                <PatientInfoCard 
                    patient={patient} 
                    user={user} 
                    t={t} 
                />
            </main>

            <footer className="p-4 border-t sticky bottom-0 bg-background">
                <Button
                    className="w-full h-12 text-base font-semibold"
                    onClick={handleConfirmBooking}
                    disabled={isSubmitting || loading || !doctor || !patient || !selectedSlot}
                >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t.bookAppointment.confirmBooking}
                </Button>
            </footer>
        </div>
    );
}

export default function BookingSummaryPage() {
    return (
        <AuthGuard>
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-background text-primary">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            }>
                <BookingSummaryContent />
            </Suspense>
        </AuthGuard>
    );
}

export const dynamic = 'force-dynamic';
