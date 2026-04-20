import { Loader2, Users, Star, Clock } from 'lucide-react';
import { useLiveToken } from '@/contexts/LiveTokenContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const QueueVisualization = () => {
    const {
        shouldShowQueueVisualization,
        isYourTurn,
        patientsAhead,
        simulatedQueue,
        currentTokenAppointment,
        yourAppointment,
        estimatedWaitTime,
        t
    } = useLiveToken() as any;

    if (!shouldShowQueueVisualization) return null;

    // Next 3 people in the queue (excluding current)
    const upNext = simulatedQueue
        .filter((a: any) => a.id !== currentTokenAppointment?.id && a.id !== yourAppointment?.id)
        .slice(0, 3);

    return (
        <div className="w-full space-y-6">
            {/* 🌌 ZONE 1: THE "NOW CONSULTING" BANNER (Wait-room Mirror) */}
            <div className="relative overflow-hidden rounded-2xl bg-primary/5 p-6 border-2 border-primary/20 animate-pulse-subtle">
                <div className="flex flex-col items-center text-center space-y-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 animate-pulse">
                        {t.liveToken.nowInside}
                    </Badge>
                    <h2 className="text-6xl font-black tracking-tighter text-primary">
                        {currentTokenAppointment?.tokenNumber || '---'}
                    </h2>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                        {t.liveToken.consultationInProgress}
                    </p>
                </div>
            </div>

            {/* 👤 ZONE 2: PERSONAL STATUS (The Promise) */}
            <Card className="border-none shadow-xl bg-card">
                <CardContent className="p-8">
                    <div className="flex flex-col items-center space-y-6">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-1">{t.liveToken.yourToken}</p>
                            <div className="flex items-center justify-center gap-3">
                                <span className="text-7xl font-black text-foreground">
                                    {yourAppointment?.tokenNumber || '---'}
                                </span>
                                {yourAppointment?.isPriority && (
                                    <Star className="h-8 w-8 text-amber-500 fill-amber-500 animate-bounce" />
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full pt-4 border-t">
                            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-xl">
                                <Clock className="h-5 w-5 text-primary mb-1" />
                                <span className="text-xl font-bold">~{estimatedWaitTime}m</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{t.liveToken.estimatedWait}</span>
                            </div>
                            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-xl">
                                <Users className="h-5 w-5 text-primary mb-1" />
                                <span className="text-xl font-bold">{patientsAhead}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{t.liveToken.patientsAhead}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ⚡ ZONE 3: THE LIVE FEED (Up Next / Integrity Proof) */}
            {upNext.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <Star className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t.liveToken.upNext}</span>
                    </div>
                    <div className="flex gap-2 w-full overflow-x-auto pb-2 no-scrollbar">
                        {upNext.map((appt: any) => (
                            <div 
                                key={appt.id} 
                                className="flex-shrink-0 bg-secondary/50 border rounded-lg px-4 py-2 flex items-center gap-2 min-w-[100px]"
                            >
                                <div className="h-2 w-2 rounded-full bg-primary/40" />
                                <span className="text-sm font-bold">{appt.tokenNumber}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
