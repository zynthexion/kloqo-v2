'use client';

import { Suspense } from 'react';
import { Loader2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AuthGuard } from '@/components/auth-guard';
import { BottomNav } from '@/components/bottom-nav';
import { useArrivalState } from '@/hooks/use-arrival-state';
import { ArrivalHeader } from '@/components/arrival/ArrivalHeader';
import { LocationStatusCard } from '@/components/arrival/LocationStatusCard';
import { AppointmentItem } from '@/components/arrival/AppointmentItem';
import type { Appointment } from '@kloqo/shared';

/**
 * ConfirmArrival Orchestrator
 * Modularized arrival confirmation flow with GPS verification and API-driven status updates.
 */
function ConfirmArrivalContent() {
    const {
        clinic, doctors,
        locationError, isCheckingLocation, checkLocation, isLocationValid,
        pendingAppointments, skippedAppointments, confirmedAppointments,
        handleConfirmArrival, handleUpdateLateMinutes, isConfirming, isUpdatingLate,
        expandedAppointments, toggleExpand, lateMinutes,
        t, router, clinicId
    } = useArrivalState();

    if (!clinic) {
        return (
            <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Loading clinic details...</p>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col font-body">
            <div className="flex-grow bg-card">
                <ArrivalHeader clinic={clinic} />

                <main className="p-6 space-y-6 bg-background rounded-t-[2rem] -mt-16 pt-8 pb-24">
                    <LocationStatusCard
                        isCheckingLocation={isCheckingLocation}
                        locationError={locationError}
                        isLocationValid={isLocationValid}
                        onCheckLocation={checkLocation}
                    />

                    {/* Pending Section */}
                    {pendingAppointments.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Pending Appointments</CardTitle>
                                <CardDescription>Confirm arrival at least 15 min before appointment.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {pendingAppointments.map(app => (
                                    <AppointmentItem
                                        key={app.id}
                                        appointment={app}
                                        doctors={doctors}
                                        isExpanded={expandedAppointments.has(app.id)}
                                        onToggleExpand={() => toggleExpand(app.id)}
                                        isConfirmed={confirmedAppointments.some(c => c.id === app.id)}
                                        t={t}
                                        onConfirmArrival={() => handleConfirmArrival(app)}
                                        isConfirming={isConfirming === app.id}
                                        isLocationValid={isLocationValid}
                                        type="pending"
                                    />
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Confirmed / Redirect Section */}
                    {confirmedAppointments.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Already Confirmed</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button className="w-full" onClick={() => router.push(`/live-token/${confirmedAppointments[0].id}`)}>
                                    <Clock className="mr-2 h-4 w-4" /> Go to Live Token
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Skipped / Rejoin Section */}
                    {skippedAppointments.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Skipped Appointments</CardTitle>
                                <CardDescription>Update late minutes to rejoin the queue.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {skippedAppointments.map(app => (
                                    <AppointmentItem
                                        key={app.id}
                                        appointment={app}
                                        doctors={doctors}
                                        isExpanded={expandedAppointments.has(app.id)}
                                        onToggleExpand={() => toggleExpand(app.id)}
                                        isConfirmed={confirmedAppointments.some(c => c.id === app.id)}
                                        t={t}
                                        lateMinutesForAppointment={app.lateMinutes || lateMinutes[app.id] || 0}
                                        onUpdateLateMinutes={(mins) => handleUpdateLateMinutes(app, mins)}
                                        isUpdatingLate={isUpdatingLate === app.id}
                                        onConfirmArrival={() => handleConfirmArrival(app)}
                                        isConfirming={isConfirming === app.id}
                                        isLocationValid={isLocationValid}
                                        type="skipped"
                                    />
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </main>
            </div>
            <BottomNav />
        </div>
    );
}

function ConfirmArrivalPage() {
    return (
        <AuthGuard>
            <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin mx-auto mt-20" />}>
                <ConfirmArrivalContent />
            </Suspense>
        </AuthGuard>
    );
}

export default ConfirmArrivalPage;

export const dynamic = 'force-dynamic';
