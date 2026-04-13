'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { WalkInCard } from '@/components/home/WalkInCard';
import { AppointmentCarousel } from '@/components/home/AppointmentCard';
import type { Appointment, Doctor } from '@kloqo/shared';

interface HomeAppointmentsProps {
    appointmentsLoading: boolean;
    walkInAppointment: Appointment | null;
    upcomingAppointments: Appointment[];
    effectiveUserDoctors: Doctor[];
    t: any;
    departments: any[];
    language: any;
    clinics: any[];
}

export function HomeAppointments({
    appointmentsLoading, walkInAppointment, upcomingAppointments, effectiveUserDoctors, t, departments, language, clinics
}: HomeAppointmentsProps) {
    const showLoading = appointmentsLoading && !walkInAppointment && upcomingAppointments.length === 0;

    return (
        <div className="mt-[-80px] px-6 space-y-4">
            {showLoading ? (
                <Skeleton className="h-40 w-full bg-primary/20" />
            ) : (
                <>
                    {walkInAppointment && (
                        <WalkInCard
                            appointment={walkInAppointment}
                            userDoctors={effectiveUserDoctors}
                            t={t}
                            departments={departments}
                            language={language}
                            clinics={clinics}
                        />
                    )}
                    {upcomingAppointments.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-lg font-bold text-card-foreground">
                                {t.home.upcomingAppointments}
                            </h2>
                            <AppointmentCarousel
                                appointments={upcomingAppointments}
                                doctors={effectiveUserDoctors}
                                t={t}
                                departments={departments}
                                language={language}
                                clinics={clinics}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
