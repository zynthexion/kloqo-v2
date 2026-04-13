'use client';

/**
 * AppointmentCard & AppointmentCarousel
 *
 * Extracted from home/page.tsx (was inline lines 195-268).
 * AppointmentCard displays a single upcoming appointment summary.
 * AppointmentCarousel renders a horizontal scrollable list of AppointmentCards.
 */

import Link from 'next/link';
import { format } from 'date-fns/format';
import { parse } from 'date-fns/parse';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { formatDayOfWeek, formatDate } from '@/lib/date-utils';
import { getArriveByTimeFromAppointment } from '@/lib/utils';
import { getLocalizedDepartmentName } from '@/lib/department-utils';
import type { Appointment, Doctor, Clinic } from '@kloqo/shared';

interface AppointmentCardProps {
    appointment: Appointment;
    departments: any[];
    language: 'en' | 'ml';
    doctors: Doctor[];
    t: any;
    clinics: Clinic[];
}

export function AppointmentCard({ appointment, departments, language, doctors, t, clinics }: AppointmentCardProps) {
    let day: string, month: string, dayOfMonth: string;

    try {
        const dateObj = parse(appointment.date, 'd MMMM yyyy', new Date());
        day = formatDayOfWeek(dateObj, language);
        month = formatDate(dateObj, 'MMM', language);
        dayOfMonth = format(dateObj, 'dd');
    } catch {
        try {
            const dateObj = new Date(appointment.date);
            day = formatDayOfWeek(dateObj, language);
            month = formatDate(dateObj, 'MMM', language);
            dayOfMonth = format(dateObj, 'dd');
        } catch {
            const parts = appointment.date.split(' ');
            month = parts[0];
            dayOfMonth = parts[1];
            day = formatDayOfWeek(new Date(), language);
        }
    }

    const appointmentDoctor = doctors.find(d => d.name === appointment.doctor);

    return (
        <Link href="/appointments">
            <Card className="bg-primary-foreground/10 border-primary-foreground/20 shadow-none text-primary-foreground cursor-pointer hover:bg-primary-foreground/20 transition-colors">
                <CardContent className="p-4 flex gap-4 items-center">
                    <div className="text-center w-14 shrink-0 bg-primary-foreground/20 rounded-lg p-2">
                        <p className="text-sm font-medium">{month}</p>
                        <p className="text-2xl font-bold">{dayOfMonth}</p>
                        <p className="text-sm font-medium">{day}</p>
                    </div>
                    <div className="border-l border-primary-foreground/20 pl-4">
                        <p className="text-xs opacity-80">
                            {t.home.arriveBy}: {getArriveByTimeFromAppointment(appointment, appointmentDoctor)}
                        </p>
                        <p className="font-bold text-md mt-1">{appointment.doctor}</p>
                        <p className="text-sm opacity-80">{getLocalizedDepartmentName(appointment.department, language, departments)}</p>
                        <p className="text-sm opacity-80">{appointment.patientName}</p>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

interface AppointmentCarouselProps {
    appointments: Appointment[];
    departments: any[];
    language: 'en' | 'ml';
    doctors: Doctor[];
    t: any;
    clinics: Clinic[];
}

export function AppointmentCarousel({ appointments, departments, language, doctors, t, clinics }: AppointmentCarouselProps) {
    if (appointments.length === 0) return null;

    const doctorsArray = Array.isArray(doctors) ? doctors : [];

    return (
        <Carousel opts={{ align: 'start', dragFree: true }} className="w-full">
            <CarouselContent className="-ml-4">
                {appointments.map((appt) => (
                    <CarouselItem key={appt.id} className="basis-auto pl-4">
                        <AppointmentCard
                            appointment={appt}
                            departments={departments}
                            language={language}
                            doctors={doctorsArray}
                            t={t}
                            clinics={clinics}
                        />
                    </CarouselItem>
                ))}
            </CarouselContent>
        </Carousel>
    );
}
