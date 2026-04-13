'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock } from 'lucide-react';
import { LottieAnimation } from '@/components/lottie-animation';
import successAnimation from '@/lib/animations/success.json';
import { getClinicTimeString } from '@kloqo/shared-core';

interface SuccessProps {
    details: any;
    t: any;
    isWalkIn: boolean;
    clinicData: any;
}

export function BookingSuccess({ details, t, isWalkIn, clinicData }: SuccessProps) {
    if (!details) return null;

    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background font-body p-4 text-center">
            <div className="flex flex-col items-center space-y-4 w-full max-w-sm">
                <LottieAnimation
                    animationData={successAnimation}
                    size={200}
                    autoplay={true}
                    loop={false}
                    className="mb-2"
                />
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold">{t.bookAppointment.bookingSuccessful}</h1>
                    <p className="text-muted-foreground">{t.messages.appointmentBooked}</p>
                </div>
                <Card className="bg-muted/50 p-6 w-full max-w-xs mt-4 border-0 shadow-lg">
                    <CardContent className="p-0 flex flex-col items-center space-y-4">
                        <div className="flex flex-col items-center">
                            <p className="text-sm text-muted-foreground uppercase tracking-widest">{t.liveToken.yourToken}</p>
                            <p className="text-4xl font-bold text-primary">{details.token}</p>
                        </div>
                        <div className="flex flex-col items-center space-y-2 w-full pt-4 border-t border-border">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <p className="text-sm font-medium">{details.date}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <div className="text-center">
                                    <span className="text-sm text-muted-foreground block">{isWalkIn ? t.liveToken.yourAppointmentTimeIs : t.home.arriveBy}</span>
                                    <p className="text-xl font-bold">{details.arriveBy}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <div className="w-full flex flex-col gap-2 mt-6">
                    <Button className="w-full" asChild>
                        <Link href={isWalkIn ? `/live-token/${details.id}` : "/appointments"}>
                            {isWalkIn ? t.appointments.seeLiveToken : t.appointments.myAppointments}
                        </Link>
                    </Button>
                    <Button variant="ghost" className="w-full" asChild>
                        <Link href="/home">Return to Home</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
