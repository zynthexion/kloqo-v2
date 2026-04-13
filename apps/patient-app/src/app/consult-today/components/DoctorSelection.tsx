'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Doctor } from '@kloqo/shared';
import { getLocalizedDepartmentName } from '@/lib/department-utils';
import { useLanguage } from '@/contexts/language-context';
import { useMasterDepartments } from '@/hooks/use-master-departments';

export const DoctorSelection = ({ doctors, onSelect }: { doctors: Doctor[], onSelect: (doctor: Doctor) => void }) => {
    const { t, language } = useLanguage();
    const { departments } = useMasterDepartments();
    const [expandedBios, setExpandedBios] = useState<Record<string, boolean>>({});

    const toggleBio = (doctorId: string) => {
        setExpandedBios(prev => ({ ...prev, [doctorId]: !prev[doctorId] }));
    };

    return (
        <div className="space-y-4">
            {doctors.map(doctor => {
                const isExpanded = expandedBios[doctor.id];
                const bio = doctor.bio || doctor.specialty || '';
                const shouldTruncate = bio.length > 100;
                const displayBio = shouldTruncate && !isExpanded ? bio.substring(0, 100) + '...' : bio;

                return (
                    <Card
                        key={doctor.id}
                        onClick={() => onSelect(doctor)}
                        className="cursor-pointer transition-all hover:shadow-lg"
                    >
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
                            </div>
                            {displayBio && (
                                <div className="pt-2 border-t">
                                    <p className="text-sm text-muted-foreground">
                                        {displayBio}
                                        {shouldTruncate && (
                                            <Button
                                                variant="link"
                                                className="h-auto p-0 ml-1 text-xs"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleBio(doctor.id);
                                                }}
                                            >
                                                {isExpanded ? t.buttons.readLess : t.buttons.readMore}
                                            </Button>
                                        )}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};
