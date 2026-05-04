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
import { formatDate, formatDayOfWeek } from '@/lib/date-utils';
import { getArriveByTimeFromAppointment, parseClinicDate } from '@/lib/utils';
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
    let day: string = '---', month: string = '---', dayOfMonth: string = '--';

    try {
        const dateObj = parseClinicDate(appointment.date);
        day = formatDayOfWeek(dateObj, language);
        month = formatDate(dateObj, 'MMM', language);
        dayOfMonth = format(dateObj, 'dd');
    } catch {
        const parts = appointment.date.split(' ');
        month = parts[0] || '---';
        dayOfMonth = parts[1] || '--';
        day = formatDayOfWeek(new Date(), language);
    }

    const appointmentDoctor = doctors.find(d => d.name === appointment.doctor);

    return (
        <Link href="/appointments">
            <Card className="bg-white border-primary/10 shadow-sm text-slate-900 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] rounded-2xl overflow-hidden">
                <CardContent className="p-4 flex gap-4 items-center">
                    <div className="text-center w-14 shrink-0 bg-primary/10 rounded-xl p-2 border border-primary/5">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-tighter">{month}</p>
                        <p className="text-2xl font-black text-slate-900">{dayOfMonth}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{day}</p>
                    </div>
                    <div className="border-l border-slate-100 pl-4 flex-grow min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {t.home.arriveBy}: <span className="text-slate-600">{getArriveByTimeFromAppointment(appointment, appointmentDoctor)}</span>
                            </p>
                        </div>
                        <p className="font-bold text-slate-900 mt-1 truncate">{appointment.doctor}</p>
                        <p className="text-xs text-slate-500 truncate">{getLocalizedDepartmentName(appointment.department, language, departments)}</p>
                        <p className="text-xs text-primary font-bold mt-1">{appointment.patientName}</p>
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
