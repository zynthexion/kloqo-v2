'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthGuard } from '@/components/auth-guard';
import { BottomNav } from '@/components/bottom-nav';
import { LiveTokenProvider } from '@/contexts/LiveTokenContext';
import { useLiveTokenState } from '@/hooks/use-live-token-state';
import { AppointmentStatusCard } from '@/components/live-token/AppointmentStatusCard';
import { BottomMessage } from '@/components/live-token/BottomMessage';
import { QueueVisualization } from '@/components/live-token/QueueVisualization';
import { PatientSwitcher } from '@/components/live-token/PatientSwitcher';

function LiveTokenPage({ params }: { params: Promise<{ appointmentId: string }> }) {
    const { appointmentId } = use(params);
    const state = useLiveTokenState(appointmentId);

    if ('loading' in state && state.loading) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground animate-pulse">Loading Live Token...</p>
                </div>
            </div>
        );
    }

    // Cast to LiveTokenContextValue safely
    const contextValue = state as any;

    return (
        <LiveTokenProvider value={contextValue}>
            <div className="flex min-h-screen w-full flex-col bg-[hsl(var(--app-background))] font-body text-foreground">
                <header className="flex items-center p-4 gap-2 border-b bg-card shadow-sm">
                    <Link href="/home" className="p-2 hover:bg-muted rounded-full transition-colors">
                        <ArrowLeft className="h-6 w-6" />
                    </Link>
                    <h1 className="text-xl font-bold text-center flex-grow">
                        {contextValue.t.liveToken.title}
                    </h1>
                </header>

                <main className="flex-grow flex flex-col items-center justify-start p-4 pb-32 space-y-8 overflow-y-auto">
                    {/* Patient Switcher (if family has multiple) */}
                    <PatientSwitcher />

                    {contextValue.yourAppointment ? (
                        <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Main Status & Arrival Confirmation */}
                            <AppointmentStatusCard />

                            {/* Live Queue Visualization */}
                            <QueueVisualization />

                            {/* Status Messages & Estimated Wait */}
                            <BottomMessage />
                        </div>
                    ) : (
                        <Card className="w-full max-w-sm text-center mt-10">
                            <CardContent className="p-10 space-y-6">
                                <div className="flex justify-center">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                                        <Info className="h-10 w-10 text-primary" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold">{contextValue.t.liveToken.noAppointments || 'No Token Found'}</h2>
                                    <p className="text-muted-foreground">
                                        {contextValue.t.liveToken.noAppointmentsDescription || 'We could not find any active token for this ID.'}
                                    </p>
                                </div>
                                <Button asChild size="lg" className="w-full">
                                    <Link href="/appointments">
                                        {contextValue.t.appointments?.myAppointments || 'View My Appointments'}
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </main>

                <BottomNav />
            </div>
        </LiveTokenProvider>
    );
}

export default function Page({ params }: { params: Promise<{ appointmentId: string }> }) {
    return (
        <AuthGuard>
            <LiveTokenPage params={params} />
        </AuthGuard>
    );
}
