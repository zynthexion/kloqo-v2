'use client';

/**
 * WalkInCard
 *
 * Extracted from home/page.tsx (was inline lines 150-193).
 * Displays an active walk-in token with a "View Live Queue" link.
 * Supports both classic (numbered) and advanced token distributions.
 */

import Link from 'next/link';
import { Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getArriveByTimeFromAppointment } from '@/lib/utils';
import { getLocalizedDepartmentName } from '@/lib/department-utils';
import type { Appointment, Doctor, Clinic } from '@kloqo/shared';

interface WalkInCardProps {
    appointment: Appointment;
    userDoctors: Doctor[];
    t: any;
    departments: any[];
    language: 'en' | 'ml';
    clinics: Clinic[];
}

export function WalkInCard({ appointment, userDoctors, t, departments, language, clinics }: WalkInCardProps) {
    const clinic = clinics.find(c => c.id === appointment.clinicId);
    const isClassic = clinic?.tokenDistribution === 'classic';
    const appointmentDoctor = userDoctors.find(d => d.name === appointment.doctor);

    return (
        <Card className="bg-primary-foreground/10 border-primary-foreground/20 shadow-lg text-primary-foreground">
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary-foreground/20 p-3 rounded-lg">
                            <Ticket className="h-8 w-8" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">{t.home.yourWalkInToken}</p>
                            <p className="text-3xl font-bold">
                                {isClassic
                                    ? (appointment.classicTokenNumber ? `#${appointment.classicTokenNumber}` : '--')
                                    : appointment.tokenNumber
                                }
                            </p>
                        </div>
                    </div>
                    <Button asChild variant="secondary" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                        <Link href="/live-token">{t.home.viewLiveQueue}</Link>
                    </Button>
                </div>
                <div className="mt-4 border-t border-primary-foreground/20 pt-4 flex items-start justify-between">
                    <div>
                        <p className="font-bold text-lg">{appointment.doctor}</p>
                        <p className="text-sm opacity-80">{getLocalizedDepartmentName(appointment.department, language, departments)}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t.home.patientLabel}: <span className="font-semibold">{appointment.patientName}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs opacity-80">{t.home.timeLabel}</p>
                        <p className="font-bold text-lg">{getArriveByTimeFromAppointment(appointment, appointmentDoctor)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
