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
        <Card className="bg-primary border-none shadow-xl shadow-primary/20 text-white rounded-[2rem] overflow-hidden relative">
            {/* Subtle glass effect pattern */}
            <div className="absolute -right-10 -top-10 h-40 w-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            
            <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md">
                            <Ticket className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
                                {t.home.yourWalkInToken}
                            </p>
                            <p className="text-4xl font-black tracking-tight mt-0.5">
                                {isClassic
                                    ? (appointment.classicTokenNumber ? `#${appointment.classicTokenNumber}` : '--')
                                    : appointment.tokenNumber
                                }
                            </p>
                        </div>
                    </div>
                    <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-bold rounded-2xl h-12 shadow-md">
                        <Link href={`/live-token/${appointment.id}`}>{t.home.viewLiveQueue}</Link>
                    </Button>
                </div>
                
                <div className="mt-8 pt-6 border-t border-white/10 flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="font-bold text-xl leading-tight">{appointment.doctor}</p>
                        <p className="text-sm text-white/70 font-medium">
                            {getLocalizedDepartmentName(appointment.department, language, departments)}
                        </p>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full mt-2">
                            <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                            <p className="text-[10px] font-bold uppercase tracking-wider">
                                {appointment.patientName}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">{t.home.timeLabel}</p>
                        <p className="font-black text-xl">{getArriveByTimeFromAppointment(appointment, appointmentDoctor)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
