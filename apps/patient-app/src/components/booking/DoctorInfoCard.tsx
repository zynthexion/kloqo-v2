'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getLocalizedDepartmentName } from '@/lib/department-utils';
import type { Doctor } from '@kloqo/shared';
import { useMasterDepartments } from '@/hooks/use-master-departments';

interface DoctorInfoCardProps {
    doctor: Doctor | null;
    loading: boolean;
    language: string;
    t: any;
}

export function DoctorProfileSkeleton() {
    return (
        <Card className="border-0 shadow-sm">
            <CardContent className="flex items-center gap-4 pt-6">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                </div>
            </CardContent>
        </Card>
    );
}

export function DoctorInfoCard({ doctor, loading, language, t }: DoctorInfoCardProps) {
    const { departments } = useMasterDepartments();
    const [isBioExpanded, setIsBioExpanded] = useState(false);

    if (loading || !doctor) return <DoctorProfileSkeleton />;

    return (
        <Card className="border-0 shadow-sm">
            <CardContent className="flex items-start gap-4 pt-6">
                <Avatar className="h-20 w-20">
                    {doctor.avatar && <AvatarImage src={doctor.avatar} alt={doctor.name} />}
                    <AvatarFallback>{doctor.name[0]}</AvatarFallback>
                </Avatar>
                <div className="space-y-1 flex-grow">
                    <h2 className="text-xl font-bold">{doctor.name}</h2>
                    <p className="text-md text-muted-foreground">{getLocalizedDepartmentName(doctor.department, language as any, departments)}</p>
                    {doctor.consultationFee && (
                        <p className="text-md font-semibold text-primary font-mono">&#8377;{doctor.consultationFee}</p>
                    )}
                </div>
            </CardContent>
            {doctor.bio && (
                <CardContent>
                    <p className={cn("text-sm text-muted-foreground transition-all", !isBioExpanded && "line-clamp-2")}>
                        {doctor.bio}
                    </p>
                    <Button 
                        variant="link" 
                        size="sm" 
                        onClick={() => setIsBioExpanded(!isBioExpanded)} 
                        className="p-0 h-auto text-primary"
                    >
                        {isBioExpanded ? t.buttons.readLess : t.buttons.readMore}
                    </Button>
                </CardContent>
            )}
        </Card>
    );
}
