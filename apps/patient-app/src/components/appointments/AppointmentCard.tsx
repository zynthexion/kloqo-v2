'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parse, isPast, isToday } from 'date-fns';
import { cn, getArriveByTimeFromAppointment, parseAppointmentDateTime } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { getLocalizedDepartmentName } from '@/lib/department-utils';
import { formatDayOfWeek, formatDate } from '@/lib/date-utils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import dynamic from 'next/dynamic';
import type { Appointment, Doctor, Clinic } from '@kloqo/shared';

const ReviewPrompt = dynamic(() => import('@/components/review-prompt').then(mod => mod.ReviewPrompt), { ssr: false });

interface AppointmentCardProps {
    appointment: Appointment;
    isHistory?: boolean;
    user: any;
    t: any;
    departments: any[];
    language: 'en' | 'ml';
    onCancelled: (id: string) => void;
    doctor?: Doctor | null;
    clinic?: Clinic;
}

export function AppointmentCard({
    appointment, isHistory, user, t, departments, language, onCancelled, doctor, clinic
}: AppointmentCardProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [isCancelling, setIsCancelling] = useState(false);
    const [showReview, setShowReview] = useState(false);

    let dateObj;
    try { dateObj = parse(appointment.date, "d MMMM yyyy", new Date()); } catch { dateObj = new Date(appointment.date); }
    
    const day = formatDayOfWeek(dateObj, language);
    const month = formatDate(dateObj, 'MMM', language);
    const dayOfMonth = format(dateObj, 'dd');

    const handleCancel = async () => {
        setIsCancelling(true);
        try {
            await apiRequest(`/appointments/${appointment.id}/cancel`, { method: 'POST' });
            onCancelled(appointment.id);
            toast({ title: t.appointments.appointmentCancelled });
        } catch (err) {
            toast({ variant: 'destructive', title: t.appointments.cancellationFailed });
        } finally { setIsCancelling(false); }
    };

    const handleReschedule = () => {
        if (appointment.doctorId && appointment.patientId) {
            router.push(`/book-appointment?doctorId=${appointment.doctorId}&clinicId=${appointment.clinicId}&patientId=${appointment.patientId}&edit=true&appointmentId=${appointment.id}`);
        } else {
            toast({ variant: 'destructive', title: 'Could not reschedule.' });
        }
    };

    return (
        <Card className={cn("shadow-md", isHistory ? "bg-gray-50" : "bg-blue-50")}>
            <CardContent className="p-4">
                <div className="flex justify-between items-start">
                    <div className="flex gap-4">
                        <div className="text-center w-12 shrink-0">
                            <p className="text-sm">{month}</p>
                            <p className="text-2xl font-bold">{dayOfMonth}</p>
                            <p className="text-sm">{day}</p>
                        </div>
                        <div className="border-l pl-4">
                            {!isHistory && !appointment.tokenNumber?.startsWith('W') && (
                                <p className="text-xs text-muted-foreground">{t.home.arriveBy}</p>
                            )}
                            <p className="font-semibold">{getArriveByTimeFromAppointment(appointment, doctor)}</p>
                            <p className="font-bold text-lg mt-2">{appointment.doctor}</p>
                            <p className="text-sm text-muted-foreground">{getLocalizedDepartmentName(appointment.department, language, departments)}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t.appointments.token}: <span className="font-semibold">
                                    {clinic?.tokenDistribution === 'classic' ? (appointment.status === 'Pending' ? '--' : `#${appointment.classicTokenNumber?.toString().padStart(3, '0')}`) : appointment.tokenNumber}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                        <p className="text-sm font-semibold truncate max-w-[80px]">{appointment.patientName}</p>
                        <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            appointment.status === 'Confirmed' ? "bg-green-100 text-green-800" :
                            appointment.status === 'Cancelled' ? "bg-red-100 text-red-800" : "bg-gray-100"
                        )}>
                            {appointment.status}
                        </span>
                    </div>
                </div>

                {!isHistory && appointment.status !== 'Cancelled' && (
                    <div className="flex justify-end gap-2 mt-4">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" className="rounded-full text-blue-600" disabled={isCancelling}>
                                    {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : t.appointments.cancel}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t.appointments.areYouSure}</AlertDialogTitle>
                                    <AlertDialogDescription>{t.appointments.cancelConfirmDesc}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t.appointments.back}</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleCancel} className="bg-destructive">{t.appointments.yesCancel}</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        {appointment.status !== 'Confirmed' && !appointment.tokenNumber?.startsWith('W') && (
                            <Button variant="ghost" className="rounded-full text-green-600" onClick={handleReschedule}>
                                {t.appointments.reschedule}
                            </Button>
                        )}
                    </div>
                )}

                {appointment.status === 'Completed' && !appointment.reviewed && (
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" className="rounded-full text-yellow-600 border-yellow-600" onClick={() => setShowReview(true)}>
                            <Star className="h-4 w-4 mr-2" /> Review Doctor
                        </Button>
                    </div>
                )}
                {showReview && <ReviewPrompt appointment={appointment} onClose={() => setShowReview(false)} />}
            </CardContent>
        </Card>
    );
}
