'use client';

// Prevent static generation - this page requires Firebase context
export const dynamic = 'force-dynamic';

import { ArrowLeft, MapPin, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/hooks/api/use-user';
import { useLanguage } from '@/contexts/language-context';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Skeleton } from '@/components/ui/skeleton';
import type { Doctor } from '@kloqo/shared';

// Extracted Components and Hooks
import { SelectedDoctorCard } from './components/SelectedDoctorCard';
import { DoctorSelection } from './components/DoctorSelection';
import { useClinicLocation } from './hooks/use-clinic-location';
import { useWalkInAvailability } from './hooks/use-walk-in-availability';
import { useClinicData } from './hooks/use-clinic-data';
import { useExistingAppointments } from './hooks/use-existing-appointments';
import { useQRScanner } from './hooks/use-qr-scanner';

function ConsultTodayContent() {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: userLoading } = useUser();
    const { t } = useLanguage();
    
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
    
    const clinicId = useMemo(() => {
        const id = searchParams.get('clinicId');
        return id ? id.trim() : null;
    }, [searchParams]);

    const doctorId = useMemo(() => {
        const id = searchParams.get('doctorId');
        return id ? id.trim() : null;
    }, [searchParams]);

    // Custom Hooks
    const { clinic, doctors, doctorsLoading } = useClinicData(clinicId);

    const {
        locationError,
        setLocationError,
        isCheckingLocation,
        permissionGranted,
        setPermissionGranted,
        checkLocation,
        handleManualEntry
    } = useClinicLocation(clinic);

    useExistingAppointments(clinicId, user, permissionGranted);

    const {
        isScanning,
        handleCameraScan
    } = useQRScanner({ clinic, clinicId, checkLocation, setLocationError, setPermissionGranted });

    const {
        getWalkInAvailabilityState,
        isWalkInAvailable
    } = useWalkInAvailability(clinic?.tokenDistribution);

    // Auto-select doctor if doctorId is provided in URL
    useEffect(() => {
        if (doctorId && doctors.length > 0 && !selectedDoctor) {
            const doctor = doctors.find(d => d.id === doctorId);
            if (doctor) {
                setSelectedDoctor(doctor);
            }
        }
    }, [doctorId, doctors, selectedDoctor]);

    // Redirect to login if user is missing
    useEffect(() => {
        if (!userLoading && !user) {
            const params = new URLSearchParams();
            if (clinicId) {
                params.set('clinicId', clinicId);
                const redirectUrl = `/consult-today?clinicId=${clinicId}`;
                params.set('redirect', redirectUrl);
            }
            router.push(`/login?${params.toString()}`);
        }
    }, [user, userLoading, router, clinicId]);

    const handleSelectDoctor = (doctor: Doctor) => {
        const availability = getWalkInAvailabilityState(doctor);
        if (availability.state !== 'available') {
            if (availability.state === 'waiting') {
                setLocationError(`Dr. ${doctor.name} ${(t.consultToday as any).waitingForPreviousSession || 'is currently finishing the previous session. Bookings for the next session will open shortly.'}`);
            } else {
                setLocationError(`Dr. ${doctor.name} ${t.consultToday.doctorNotAvailableWalkIn}`);
            }
            return;
        }
        setSelectedDoctor(doctor);
    }

    const handleBack = () => {
        if (selectedDoctor) {
            setSelectedDoctor(null);
            setLocationError(null);
        } else {
            router.back();
        }
    }

    // Show only doctors available for walk-in based on timing
    const availableDoctors = doctors.filter((doc) => isWalkInAvailable(doc));

    // Progressive loading
    if (!userLoading && !user) {
        return null; // AuthGuard handles redirect
    }

    if (!permissionGranted) {
        return (
            <div className="flex min-h-screen w-full flex-col bg-background font-body">
                <header className="flex items-center p-4 border-b">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/home')}>
                        <ArrowLeft className="h-5 w-5" />
                        <span className="sr-only">Back</span>
                    </Button>
                    <h1 className="text-xl font-bold text-center flex-grow">{t.consultToday.walkInAppointment}</h1>
                    <div className="w-8"></div>
                </header>

                <main className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-3 rounded-full bg-primary/10">
                                    <Shield className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle className="text-lg">{t.consultToday.verifyYourLocation}</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {t.consultToday.locationVerificationDesc}
                            </p>

                            {!isCheckingLocation && (
                                <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                                    {locationError || t.consultToday.mustBeAtClinic}
                                </div>
                            )}

                            {isCheckingLocation ? (
                                <div className="text-center py-8 space-y-3">
                                    <Skeleton className="h-10 w-10 rounded-full mx-auto" />
                                    <Skeleton className="h-4 w-40 mx-auto" />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <Button
                                        onClick={handleManualEntry}
                                        disabled={isScanning || isCheckingLocation}
                                        className="w-full"
                                    >
                                        <MapPin className="mr-2 h-4 w-4" />
                                        {t.consultToday.tryAgain}
                                    </Button>

                                    <Button
                                        onClick={() => router.push(clinicId ? `/clinics/${clinicId}` : '/clinics')}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        {t.consultToday.bookForAnotherDay}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-background font-body">
            <header className="flex items-center p-4 border-b">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleBack}>
                    <ArrowLeft className="h-5 w-5" />
                    <span className="sr-only">Back</span>
                </Button>
                <h1 className="text-xl font-bold text-center flex-grow">
                    {selectedDoctor ? t.consultToday.bookWalkIn : t.consultToday.selectDoctor}
                </h1>
                <div className="w-8"></div>
            </header>
            <main className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6">
                {selectedDoctor ? (
                    <SelectedDoctorCard
                        doctor={selectedDoctor}
                        onBack={() => setSelectedDoctor(null)}
                    />
                ) : (
                    <>
                        {locationError && (
                            <Card className="bg-destructive/10 border-destructive/50">
                                <CardContent className="p-4">
                                    <p className="text-destructive text-sm">
                                        {locationError}
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {doctorsLoading && (
                            <div className="space-y-4">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        )}

                        {!doctorsLoading && availableDoctors.length > 0 && (
                            <DoctorSelection doctors={availableDoctors} onSelect={handleSelectDoctor} />
                        )}

                        {!doctorsLoading && availableDoctors.length === 0 && (
                            <Card>
                                <CardContent className="p-8 text-center space-y-4">
                                    <p className="text-lg font-semibold text-destructive">
                                        {t.consultToday.noDoctorsForWalkIn}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Walk-in registration for this session opens 30 minutes before the start time. To secure a guaranteed spot right now, please use Advance Booking.
                                    </p>
                                    <Button
                                        onClick={() => router.push(clinicId ? `/clinics/${clinicId}` : '/clinics')}
                                        variant="outline"
                                        className="mt-4"
                                    >
                                        {t.consultToday.bookForAnotherDay}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

function ConsultTodayPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>
        }>
            <ConsultTodayContent />
        </Suspense>
    );
}

export default function ConsultTodayPageWithAuth() {
    return (
        <AuthGuard>
            <ConsultTodayPage />
        </AuthGuard>
    );
}