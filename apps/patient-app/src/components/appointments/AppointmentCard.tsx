'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parse, isPast, isToday } from 'date-fns';
import { cn, getArriveByTimeFromAppointment, parseAppointmentDateTime, parseClinicDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
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

    let dateObj: Date;
    try {
        dateObj = parseClinicDate(appointment.date);
    } catch {
        dateObj = new Date();
    }
    if (isNaN(dateObj.getTime())) dateObj = new Date();

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
        <motion.div
            whileHover={{ y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
            <Card className={cn(
                "relative overflow-hidden border-white/5 shadow-2xl transition-all duration-300",
                isHistory ? "bg-white/5" : "bg-white/[0.08] border-white/10"
            )}>
                {/* Status-based edge glow */}
                <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1",
                    appointment.status === 'Confirmed' ? "bg-emerald-500" :
                    appointment.status === 'Cancelled' ? "bg-rose-500" :
                    appointment.status === 'Skipped' ? "bg-amber-500" : "bg-primary"
                )} />

                <CardContent className="p-5">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex gap-5">
                            {/* Date Badge */}
                            <div className="flex flex-col items-center justify-center w-14 h-16 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm shrink-0">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{month}</p>
                                <p className="text-2xl font-black text-white leading-none my-0.5">{dayOfMonth}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{day}</p>
                            </div>

                            <div className="flex flex-col justify-center min-w-0">
                                {!isHistory && !appointment.tokenNumber?.startsWith('W') && (
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                        {t.home.arriveBy} <span className="text-slate-300 ml-1">{getArriveByTimeFromAppointment(appointment, doctor)}</span>
                                    </p>
                                )}
                                <h3 className="font-bold text-lg text-white tracking-tight truncate leading-tight">
                                    {appointment.doctor}
                                </h3>
                                <p className="text-xs font-medium text-slate-400 mt-0.5">
                                    {getLocalizedDepartmentName(appointment.department, language, departments)}
                                </p>
                                
                                <div className="flex items-center gap-2 mt-3">
                                    <div className="px-2 py-0.5 bg-white/5 rounded-lg border border-white/5">
                                        <p className="text-[10px] font-bold text-slate-500">
                                            {t.appointments.token}: <span className="text-slate-200">
                                                {clinic?.tokenDistribution === 'classic' ? (appointment.status === 'Pending' ? '--' : `#${appointment.classicTokenNumber?.toString().padStart(3, '0')}`) : appointment.tokenNumber}
                                            </span>
                                        </p>
                                    </div>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                        appointment.status === 'Confirmed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                        appointment.status === 'Cancelled' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" :
                                        appointment.status === 'Skipped' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                                        "bg-white/10 border-white/10 text-slate-400"
                                    )}>
                                        {appointment.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-3 text-right">
                            <div className="flex flex-col items-end">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">PATIENT</p>
                                <p className="text-sm font-bold text-white truncate max-w-[100px]">{appointment.patientName}</p>
                            </div>
                            
                            {appointment.status === 'Completed' && !appointment.reviewed && (
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white transition-all" 
                                    onClick={() => setShowReview(true)}
                                >
                                    <Star className="h-3 w-3 mr-1.5" /> Review
                                </Button>
                            )}
                        </div>
                    </div>

                    {!isHistory && appointment.status !== 'Cancelled' && (
                        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/5">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" className="h-9 px-4 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300" disabled={isCancelling}>
                                        {isCancelling ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : t.appointments.cancel}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white rounded-[2rem]">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-xl font-bold">{t.appointments.areYouSure}</AlertDialogTitle>
                                        <AlertDialogDescription className="text-slate-400">{t.appointments.cancelConfirmDesc}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="gap-2">
                                        <AlertDialogCancel className="bg-white/5 border-white/10 text-white rounded-xl hover:bg-white/10">{t.appointments.back}</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleCancel} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl">{t.appointments.yesCancel}</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {appointment.status !== 'Confirmed' && !appointment.tokenNumber?.startsWith('W') && (
                                <Button 
                                    variant="ghost" 
                                    className="h-9 px-4 rounded-xl text-xs font-bold text-primary hover:bg-primary/10" 
                                    onClick={handleReschedule}
                                >
                                    {t.appointments.reschedule}
                                </Button>
                            )}
                            
                            <Button 
                                className="h-9 px-5 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-200"
                                onClick={() => router.push(`/live-token/${appointment.id}`)}
                            >
                                Track Live
                            </Button>
                        </div>
                    )}

                    {showReview && <ReviewPrompt appointment={appointment} onClose={() => setShowReview(false)} />}
                </CardContent>
            </Card>
        </motion.div>
    );
}
