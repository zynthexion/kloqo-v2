'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, User, Phone, MapPin } from 'lucide-react';
import { getLocalizedDepartmentName } from '@/lib/department-utils';
import { formatDate, formatDayOfWeek } from '@/lib/date-utils';
import { subMinutes, format } from 'date-fns';
import { getClinicTimeString } from '@kloqo/shared-core';
import { ConvenienceFeeDisplay } from '@/components/convenience-fee-display';

export function DoctorInfoCard({ doctor, selectedSlot, language, departments, t }: { doctor: any; selectedSlot: Date | null; language: string; departments: any[]; t: any }) {
    if (!doctor) return <Skeleton className="h-40 w-full" />;

    return (
        <Card>
            <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        {doctor.avatar && <AvatarImage src={doctor.avatar} alt={doctor.name} />}
                        <AvatarFallback>{doctor.name?.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow">
                        <h3 className="font-bold text-lg">{doctor.name}</h3>
                        <p className="text-muted-foreground">{getLocalizedDepartmentName(doctor.department, language as "en" | "ml", departments)}</p>
                    </div>
                </div>
                {selectedSlot && (
                    <div className="border-t pt-4 space-y-2">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-primary" />
                            <span className="font-semibold">{formatDayOfWeek(selectedSlot, language as "en" | "ml")}, {format(selectedSlot, 'dd')}{language === 'ml' ? ' ' : ', '}{formatDate(selectedSlot, 'MMMM', language as "en" | "ml")}, {format(selectedSlot, 'yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-primary" />
                            <div>
                                <span className="text-xs text-muted-foreground block">Arrive By</span>
                                <span className="font-semibold">{getClinicTimeString(subMinutes(selectedSlot, 15))}</span>
                            </div>
                        </div>
                        {doctor.consultationFee && (
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-lg text-primary ml-1 font-mono">&#8377;</span>
                                <span className="font-semibold">{doctor.consultationFee} {t.bookAppointment.consultationFee}</span>
                            </div>
                        )}
                        <ConvenienceFeeDisplay />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function PatientInfoCard({ patient, user, t }: { patient: any; user: any; t: any }) {
    if (!patient) return <Skeleton className="h-40 w-full" />;

    return (
        <Card>
            <CardContent className="p-4 space-y-3">
                <h3 className="font-bold text-lg mb-2">{t.patientForm.personalDetails}</h3>
                <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">{t.common.name}:</span>
                    <span className="font-semibold ml-auto">{patient.name}</span>
                </div>
                <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">{t.common.age}/{t.common.gender}:</span>
                    <span className="font-semibold ml-auto">{patient.age} / {patient.sex}</span>
                </div>
                <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">{t.common.phone}:</span>
                    <span className="font-semibold ml-auto">{patient.communicationPhone || patient.phone || user?.phoneNumber}</span>
                </div>
                <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span className="text-muted-foreground">{t.common.location}:</span>
                    <span className="font-semibold ml-auto">{patient.place}</span>
                </div>
            </CardContent>
        </Card>
    );
}
