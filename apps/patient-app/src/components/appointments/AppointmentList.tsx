'use client';

import { AppointmentCard } from './AppointmentCard';
import { AppointmentCardSkeleton } from '@/components/ui/skeletons';
import { LottieAnimation } from '@/components/lottie-animation';
import emptyStateAnimation from '@/lib/animations/empty-state.json';
import type { Appointment, Doctor, Clinic } from '@kloqo/shared';

interface AppointmentListProps {
    appointments: Appointment[];
    loading: boolean;
    isHistory?: boolean;
    user: any;
    t: any;
    departments: any[];
    language: 'en' | 'ml';
    onCancelled: (id: string) => void;
    doctorsByName: Map<string, Doctor>;
    clinics: Record<string, Clinic>;
    emptyText: string;
}

export function AppointmentList({
    appointments, loading, isHistory = false, user, t, departments, language, onCancelled, doctorsByName, clinics, emptyText
}: AppointmentListProps) {
    if (loading) {
        return (
            <div className="space-y-4 pt-4">
                {[1, 2, 3].map((i) => <AppointmentCardSkeleton key={i} />)}
            </div>
        );
    }

    if (appointments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <LottieAnimation
                    animationData={emptyStateAnimation}
                    size={220}
                    autoplay={true}
                    loop={true}
                    className="mb-4"
                />
                <p className="text-center text-muted-foreground text-lg font-semibold">{emptyText}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pt-4">
            {appointments.map((appt) => (
                <AppointmentCard
                    key={appt.id}
                    appointment={appt}
                    isHistory={isHistory}
                    user={user}
                    t={t}
                    departments={departments}
                    language={language}
                    onCancelled={onCancelled}
                    doctor={doctorsByName.get((appt as any).doctor || appt.doctorName)}
                    clinic={clinics[appt.clinicId]}
                />
            ))}
        </div>
    );
}
