'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/components/auth-guard';
import { useBookingState } from '@/hooks/use-booking-state';
import { DoctorInfoCard } from '@/components/booking/DoctorInfoCard';
import { DateSelector } from '@/components/booking/DateSelector';
import { SessionSlotList } from '@/components/booking/SessionSlotList';

/**
 * BookAppointment Orchestrator
 * Modularized scheduling page following the "Dumb Frontend" architectural pattern.
 */
function BookAppointmentContent() {
    const {
        doctor, loading,
        selectedDate, dates, currentMonth, handleDateSelect,
        selectedSlot, handleSlotSelect, slotsLoading,
        backendSlots, isAdvanceCapacityReached,
        handleProceed,
        doctorId, isPhoneBooking, patientIdFromParams,
        setDateCarouselApi,
        language, t
    } = useBookingState();
    
    console.log('[DEBUG] BookAppointmentContent - Doctor:', doctor?.name, 'Loading:', loading, 'Dates Count:', dates.length);

    const backLink = isPhoneBooking && patientIdFromParams 
        ? `/phone-booking/details?doctor=${doctorId}&patientId=${patientIdFromParams}` 
        : '/home';

    return (
        <div className="flex min-h-screen w-full flex-col bg-background font-body">
            <header className="flex items-center p-4 border-b">
                <Link href={backLink} className="p-2 -ml-2">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
                <h1 className="text-xl font-bold mx-auto pr-8">{t.buttons.bookAppointment}</h1>
            </header>

            <div className="flex-grow overflow-y-auto p-4 space-y-6">
                {/* 1. Doctor Profile Section */}
                <DoctorInfoCard
                    doctor={doctor}
                    loading={loading}
                    language={language}
                    t={t}
                />

                {/* 2. Date Selection Section */}
                <div className="space-y-6">
                    <DateSelector
                        dates={dates}
                        selectedDate={selectedDate}
                        onDateSelect={handleDateSelect}
                        currentMonth={currentMonth}
                        language={language}
                        t={t}
                        setApi={setDateCarouselApi}
                    />

                    {/* 3. Slot / Session Selection Section */}
                    <SessionSlotList
                        backendSlots={backendSlots}
                        selectedSlot={selectedSlot}
                        onSlotSelect={handleSlotSelect}
                        slotsLoading={slotsLoading}
                        isAdvanceCapacityReached={isAdvanceCapacityReached}
                        t={t}
                    />
                </div>

                {!loading && !doctor && (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">Doctor details could not be loaded.</p>
                        <Button variant="link" asChild><Link href="/home">Go back home</Link></Button>
                    </div>
                )}
            </div>

            <footer className="sticky bottom-0 w-full p-4 bg-background border-t">
                <Button
                    className="w-full h-12 text-base font-bold"
                    disabled={loading || !doctor || !selectedSlot || isAdvanceCapacityReached}
                    onClick={handleProceed}
                >
                    {t.bookAppointment.proceedToBook}
                </Button>
            </footer>
        </div>
    );
}

function BookAppointmentPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        }>
            <BookAppointmentContent />
        </Suspense>
    );
}

export default function BookAppointmentPageWithAuth() {
    return (
        <BookAppointmentPage />
    );
}

export const dynamic = 'force-dynamic';
