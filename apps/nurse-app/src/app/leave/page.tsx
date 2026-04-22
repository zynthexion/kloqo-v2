'use client';

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { Loader2, ArrowLeft, CalendarIcon, Check, Trash2, AlertTriangle, ChevronRight } from 'lucide-react';
import { format, startOfDay, parseISO, isWithinInterval } from 'date-fns';
import { cn, parseTime, formatTime12Hour } from '@/lib/utils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api-client';
import { Appointment, Doctor } from '@kloqo/shared';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { NurseDesktopShell } from '@/components/layout/NurseDesktopShell';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';

type TimeSession = { from: string; to: string; };

function MarkLeaveContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { user } = useAuth();
    const { activeRole } = useActiveIdentity();

    const doctorIdFromParams = searchParams.get('doctor');

    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedSessions, setSelectedSessions] = useState<TimeSession[]>([]);
    const [doctor, setDoctor] = useState<Doctor | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clinicId, setClinicId] = useState<string | null>(null);

    useEffect(() => {
        const id = localStorage.getItem('clinicId');
        if (!id) {
            router.push('/login');
            return;
        }
        setClinicId(id);
    }, [router]);

    const fetchData = useCallback(async () => {
        if (!clinicId) return;
        const doctorId = doctorIdFromParams || localStorage.getItem('selectedDoctorId');

        if (!doctorId) {
            setLoading(false);
            toast({ variant: 'destructive', title: 'Error', description: 'No doctor selected.' });
            return;
        }

        setLoading(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const dashData = await apiRequest<any>(
                `/appointments/dashboard?clinicId=${clinicId}&date=${dateStr}`
            );
            
            const currentDoctor = dashData.doctors.find((d: any) => d.id === doctorId);
            if (currentDoctor) {
                setDoctor(currentDoctor);
                const doctorAppointments = dashData.appointments.filter((a: any) => a.doctorId === doctorId);
                setAppointments(doctorAppointments);
            } else {
                setDoctor(null);
                toast({ variant: 'destructive', title: 'Error', description: 'Doctor not found.' });
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch data.' });
        } finally {
            setLoading(false);
        }
    }, [doctorIdFromParams, clinicId, selectedDate, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const workSessionsForDay = useMemo((): TimeSession[] => {
        if (!doctor) return [];
        const dayOfWeek = selectedDate.getDay();
        const doctorAvailabilityForDay = (doctor.availabilitySlots || []).find(slot => Number(slot.day) === dayOfWeek);
        return doctorAvailabilityForDay?.timeSlots || [];
    }, [doctor, selectedDate]);

    const getAppointmentsInSession = (session: TimeSession) => {
        const start = parseTime(session.from, selectedDate);
        const end = parseTime(session.to, selectedDate);
        if (!start || !end) return [];
        
        return appointments.filter(appt => {
            const [h, m] = appt.time.split(':').map(Number);
            const apptTime = new Date(selectedDate);
            apptTime.setHours(h, m, 0, 0);
            return isWithinInterval(apptTime, { start, end }) && appt.status === 'Pending';
        });
    };

    const isSessionOnLeave = useCallback((session: TimeSession) => {
        if (!doctor || !doctor.breakPeriods) return false;

        const sessionStart = parseTime(session.from, selectedDate);
        const sessionEnd = parseTime(session.to, selectedDate);
        if (!sessionStart || !sessionEnd) return false;

        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        const breaks = doctor.breakPeriods[dateKey] || [];

        return breaks.some((bp: any) => {
            const bpStart = parseISO(bp.startTime);
            const bpEnd = parseISO(bp.endTime);
            return (bpStart <= sessionStart && bpEnd >= sessionEnd && bp.type === 'LEAVE');
        });
    }, [doctor, selectedDate]);

    const handleSessionClick = (session: TimeSession) => {
        setSelectedSessions(prev => {
            const alreadySelected = prev.some(s => s.from === session.from && s.to === session.to);
            if (alreadySelected) {
                return prev.filter(s => s.from !== session.from || s.to !== session.to);
            }
            return [...prev, session];
        });
    };

    const handleUpdateLeave = async (action: 'MARK_LEAVE' | 'CANCEL_LEAVE') => {
        if (selectedSessions.length === 0 || !doctor || !clinicId) {
            toast({ variant: 'destructive', title: 'No Sessions Selected', description: 'Please select one or more sessions.' });
            return;
        }
        
        setIsSubmitting(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const sessionsToProcess = selectedSessions.map(session => {
                const dayOfWeek = selectedDate.getDay();
                const availabilityForDay = doctor.availabilitySlots?.find(s => Number(s.day) === dayOfWeek);
                const sessionIndex = availabilityForDay?.timeSlots.findIndex(s => s.from === session.from && s.to === session.to) ?? -1;
                return { from: session.from, to: session.to, sessionIndex };
            }).filter(s => s.sessionIndex !== -1);

            await apiRequest('/doctors/leave', {
                method: 'POST',
                body: JSON.stringify({ clinicId, doctorId: doctor.id, date: dateStr, sessions: sessionsToProcess, action })
            });

            toast({
                title: action === 'MARK_LEAVE' ? 'Leave Marked Successfully' : 'Leave Canceled Successfully',
                description: `${sessionsToProcess.length} session(s) updated.`,
            });

            await fetchData();
            setSelectedSessions([]);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update leave.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDateSelect = (date: Date | undefined) => {
        if (date) {
            setSelectedDate(date);
            setSelectedSessions([]);
        }
    };

    const isDayAvailable = useCallback((date: Date): boolean => {
        if (!doctor) return false;
        const dayOfWeek = format(date, 'EEEE');
        const dayMapping: Record<string, number> = {
            'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
            'Thursday': 4, 'Friday': 5, 'Saturday': 6
        };
        const numericDay = dayMapping[dayOfWeek];
        const availableWorkDays = (doctor.availabilitySlots || []).map(s => s.day);
        return availableWorkDays.map(d => Number(d)).includes(numericDay);
    }, [doctor]);

    if (loading) return <div className="w-full h-full flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;

    const sessionsToCancel = selectedSessions.filter(s => isSessionOnLeave(s)).length;
    const sessionsToMark = selectedSessions.filter(s => !isSessionOnLeave(s)).length;

    return (
        <AppFrameLayout>
            <div className="flex flex-col h-full bg-slate-50 font-pt-sans">
                {/* Header */}
                <header className="flex items-center gap-4 p-4 bg-white border-b sticky top-0 z-20">
                    <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-lg font-black text-slate-900 leading-tight">Mark Doctor Leave</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {doctor ? `Dr. ${doctor.name}` : 'Select Doctor'}
                        </p>
                    </div>
                </header>

                <div className="flex-1 p-6 space-y-8 overflow-y-auto pb-24">
                    <section className="space-y-4">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Date</h2>
                        
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="w-full text-left bg-white rounded-3xl p-6 shadow-sm border border-slate-100 transition-all active:scale-[0.98]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                                                <CalendarIcon className="h-6 w-6 text-slate-400" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-lg leading-none">{format(selectedDate, 'EEEE, d MMMM')}</p>
                                                <p className="text-xs font-bold text-slate-400 mt-1">
                                                    Showing schedule for this date
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-slate-300" />
                                    </div>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={handleDateSelect}
                                    modifiers={{
                                        available: (date) => isDayAvailable(date)
                                    }}
                                    modifiersClassNames={{
                                        available: 'bg-green-50 text-green-700 font-bold'
                                    }}
                                    className="rounded-md border shadow"
                                    disabled={(date) => {
                                        if (date < startOfDay(new Date())) return true;
                                        return !isDayAvailable(date);
                                    }}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </section>
                    <section>
                        <h2 className="text-lg font-semibold mb-4">Select Sessions for {format(selectedDate, 'MMMM d')}</h2>
                        <div className="space-y-3">
                            {workSessionsForDay.map((session, index) => {
                                const isSelected = selectedSessions.some(s => s.from === session.from && s.to === session.to);
                                const isOnLeave = isSessionOnLeave(session);
                                const appointmentsInSession = getAppointmentsInSession(session);

                                return (
                                    <Card
                                        key={index}
                                        onClick={() => handleSessionClick(session)}
                                        className={cn("cursor-pointer transition-all",
                                            isSelected && 'ring-2 ring-destructive ring-offset-2',
                                            isOnLeave && !isSelected && 'bg-red-100 border-red-200',
                                            !isSelected && !isOnLeave && 'hover:bg-muted/80'
                                        )}
                                    >
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <div className='flex-1'>
                                                <p className={cn("font-semibold text-lg", isOnLeave && "line-through")}>
                                                    {formatTime12Hour(session.from)} - {formatTime12Hour(session.to)}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {isOnLeave ? 'On Leave' : `${appointmentsInSession.length} appointments booked`}
                                                </p>
                                            </div>
                                            {isSelected ? <Check className="h-5 w-5 text-destructive" /> : null}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                        {workSessionsForDay.length === 0 && !loading && (
                            <p className="text-center text-muted-foreground mt-4">No working hours scheduled for this day.</p>
                        )}
                    </section>
                </div>
                <footer className="p-4 border-t mt-auto bg-card sticky bottom-0 space-y-2">
                    <div className="text-center text-xs text-muted-foreground">
                        {selectedSessions.length > 0
                            ? `${selectedSessions.length} session(s) selected.`
                            : 'Select sessions to mark/unmark as leave.'
                        }
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="text-destructive" disabled={isSubmitting || sessionsToCancel === 0} onClick={() => handleUpdateLeave('CANCEL_LEAVE')}>
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <> <Trash2 className="mr-2 h-4 w-4" /> Unmark Leave ({sessionsToCancel}) </>}
                        </Button>
                        <Button variant="destructive" disabled={isSubmitting || sessionsToMark === 0} onClick={() => handleUpdateLeave('MARK_LEAVE')}>
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <> <AlertTriangle className="mr-2 h-4 w-4" /> Mark Leave ({sessionsToMark}) </>}
                        </Button>
                    </div>
                </footer>
            </div>
        </AppFrameLayout>
    );
}

export default function MarkLeavePage() {
    return (
        <Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>}>
            <MarkLeaveContent />
        </Suspense>
    );
}
