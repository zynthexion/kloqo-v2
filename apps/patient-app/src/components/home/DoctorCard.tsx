'use client';

/**
 * DoctorCard
 *
 * Extracted from home/page.tsx (was inline lines 272-298).
 * Displays a doctor's profile with availability status badge.
 * Links to the book-appointment page.
 */

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getLocalizedDepartmentName } from '@/lib/department-utils';
import type { Doctor } from '@kloqo/shared';

interface DoctorCardProps {
    doctor: Doctor;
    departments: any[];
    language: 'en' | 'ml';
    onClick?: () => void;
}

export function DoctorCard({ doctor, departments, language, onClick }: DoctorCardProps) {
    const status = doctor.consultationStatus || 'Out';
    const isAvailable = status === 'In';

    return (
        <Card 
            className="hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98] duration-200"
            onClick={onClick}
        >
            <CardContent className="p-4 flex gap-4">
                <Avatar className="w-16 h-16 border-2 border-primary/10">
                    {doctor.avatar && <AvatarImage src={doctor.avatar} alt={doctor.name} />}
                    <AvatarFallback className="bg-primary/5 text-primary font-bold">
                        {doctor.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-grow">
                    <h3 className="font-bold text-lg">{doctor.name}</h3>
                    <p className="text-sm text-muted-foreground font-medium">
                        {getLocalizedDepartmentName(doctor.department, language, departments)}
                    </p>
                    <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge
                            variant={isAvailable ? 'default' : 'destructive'}
                            className={cn(
                                'px-3 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold',
                                isAvailable ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                            )}
                        >
                            {status}
                        </Badge>
                        {doctor.latitude && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 opacity-70">
                                <span className="w-1 h-1 bg-muted-foreground rounded-full" />
                                📍 Locatable
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
