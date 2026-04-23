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
import { QuadrantContent } from '@/components/live-token/QuadrantContent';

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

    const contextValue = state as any;

    return (
        <LiveTokenProvider value={contextValue}>
            <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black font-body text-slate-100">
                {/* Modern Floating Header */}
                <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-6 bg-gradient-to-b from-black/60 to-transparent">
                    <Link href="/home" className="p-3 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl transition-all active:scale-95 group">
                        <ArrowLeft className="h-6 w-6 text-slate-300 group-hover:text-white" />
                    </Link>
                    <div className="text-right">
                        <p className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">KLOQO LIVE</p>
                        <h1 className="text-lg font-bold text-white tracking-tight">
                            {contextValue.t.liveToken.title}
                        </h1>
                    </div>
                </div>

                <main className="relative h-full w-full flex flex-col items-center p-0 pt-24">
                    <QuadrantContent />

                    {!contextValue.yourAppointment && (
                        <div className="h-full flex items-center justify-center p-6">
                            <Card className="w-full max-w-sm text-center border-white/5 bg-white/5 backdrop-blur-2xl">
                                <CardContent className="p-10 space-y-6">
                                    <div className="flex justify-center">
                                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                                            <Info className="h-10 w-10 text-primary" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-bold text-white">{contextValue.t.liveToken.noAppointments || 'No Token Found'}</h2>
                                        <p className="text-slate-400 text-sm">
                                            {contextValue.t.liveToken.noAppointmentsDescription || 'We could not find any active token for this ID.'}
                                        </p>
                                    </div>
                                    <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl h-14">
                                        <Link href="/appointments">
                                            {contextValue.t.appointments?.myAppointments || 'View My Appointments'}
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </main>
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
