'use client';

import { useState } from 'react';
import nextDynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FullScreenLoader } from '@/components/full-screen-loader';
import type { Doctor } from '@kloqo/shared';
import { getLocalizedDepartmentName } from '@/lib/department-utils';
import { useLanguage } from '@/contexts/language-context';
import { useMasterDepartments } from '@/hooks/use-master-departments';

const PatientForm = nextDynamic(
    // Use the local patient-form instead of the bloated shared-ui version
    () => import('@/components/patient-form').then(mod => mod.PatientForm),
    {
        loading: () => (
            <div className="space-y-4 py-6">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
        ),
        ssr: false,
    }
);

export const SelectedDoctorCard = ({ doctor, onBack }: { doctor: Doctor, onBack: () => void }) => {
    const { t, language } = useLanguage();
    const { departments } = useMasterDepartments();
    const [isBioExpanded, setIsBioExpanded] = useState(false);

    const bio = doctor.bio || doctor.specialty || '';
    const shouldTruncate = bio.length > 100;
    const displayBio = shouldTruncate && !isBioExpanded ? bio.substring(0, 100) + '...' : bio;

    return (
        <div className="animate-in fade-in-50">
            <Card>
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            {doctor.avatar && <AvatarImage src={doctor.avatar} alt={doctor.name} />}
                            <AvatarFallback>{doctor.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div className="flex-grow">
                            <h3 className="font-bold text-lg">{doctor.name}</h3>
                            <p className="text-muted-foreground">{getLocalizedDepartmentName(doctor.department, language, departments)}</p>
                            {doctor.consultationFee && (
                                <p className="text-sm font-semibold text-primary">
                                    {t.consultToday.consultationFee}: <span className="font-mono">&#8377;{doctor.consultationFee}</span>
                                </p>
                            )}
                        </div>
                        <Button variant="link" onClick={onBack}>{t.buttons.changeDoctor}</Button>
                    </div>
                    {displayBio && (
                        <div className="pt-2 border-t">
                            <p className="text-sm text-muted-foreground">
                                {displayBio}
                                {shouldTruncate && (
                                    <Button
                                        variant="link"
                                        className="h-auto p-0 ml-1 text-xs"
                                        onClick={() => setIsBioExpanded(!isBioExpanded)}
                                    >
                                        {isBioExpanded ? t.buttons.readLess : t.buttons.readMore}
                                    </Button>
                                )}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
            <div className="mt-6">
                <PatientForm
                    selectedDoctor={doctor}
                    appointmentType="Walk-in"
                    renderLoadingOverlay={(isLoading) => <FullScreenLoader isOpen={isLoading} />}
                />
            </div>
        </div>
    );
};
