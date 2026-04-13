'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Suspense } from 'react';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CalendarIcon, Check, Trash2, AlertTriangle } from 'lucide-react';
import { format, addMinutes, differenceInMinutes, startOfDay, parseISO, eachMinuteOfInterval, isWithinInterval } from 'date-fns';
import { cn, parseTime, formatTime12Hour } from '@/lib/utils';
import Link from 'next/link';
import { Appointment, Doctor } from '@kloqo/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api-client';

type TimeSession = { from: string; to: string; };

function MarkLeaveContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const { user } = useAuth();

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

            // Fetch dashboard data which includes doctors and appointments
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

    const dailyBreaks = useMemo(() => {
        if (!doctor?.breakPeriods) return [];
        // The doctor.breakPeriods key in V2 is usually "YYYY-MM-DD"
        const dateKey = format(selectedDate, 'yyyy-MM-dd');
        return doctor.breakPeriods[dateKey] || [];
    }, [doctor, selectedDate]);

    const workSessionsForDay = useMemo((): TimeSession[] => {
        if (!doctor) return [];
        const dayOfWeek = selectedDate.getDay(); // 0-6
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
                
                return {
                    from: session.from,
                    to: session.to,
                    sessionIndex
                };
            }).filter(s => s.sessionIndex !== -1);

            await apiRequest('/doctors/leave', {
                method: 'POST',
                body: JSON.stringify({
                    clinicId,
                    doctorId: doctor.id,
                    date: dateStr,
                    sessions: sessionsToProcess,
                    action
                })
            });

            toast({
                title: action === 'MARK_LEAVE' ? 'Leave Marked Successfully' : 'Leave Canceled Successfully',
                description: `${sessionsToProcess.length} session(s) updated.`,
            });

            await fetchData();
            setSelectedSessions([]);

        } catch (error: any) {
            console.error("Error updating leave:", error);
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


    if (loading) {
        return (
            <AppFrameLayout>
                <div className="w-full h-full flex flex-col items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 text-muted-foreground">Loading Schedule...</p>
                </div>
            </AppFrameLayout>
        );
    }

    if (!doctor) {
        return (
            <AppFrameLayout>
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
                    <h2 className="text-xl font-semibold">Doctor not found</h2>
                    <Link href="/" passHref className="mt-6">
                        <Button>
                            <ArrowLeft className="mr-2" />
                            Back to Home
                        </Button>
                    </Link>
                </div>
            </AppFrameLayout>
        );
    }

    const sessionsToCancel = selectedSessions.filter(s => isSessionOnLeave(s)).length;
    const sessionsToMark = selectedSessions.filter(s => !isSessionOnLeave(s)).length;

    return (
        <AppFrameLayout>
            <div className="flex flex-col h-full">
                <header className="flex items-center gap-4 p-4 border-b">
                    <Link href="/">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold">Mark Leave</h1>
                        <p className="text-sm text-muted-foreground">For Dr. {doctor.name}</p>
                    </div>
                </header>
                <div className="p-6 overflow-y-auto flex-1">
                    <section className="mb-6">
                        <h2 className="text-lg font-semibold mb-2">Select Date</h2>
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className={cn("w-full text-left p-4 rounded-xl bg-muted/50 border", !selectedDate && "text-muted-foreground")}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="text-center">
                                                <p className="text-4xl font-bold text-destructive/80">{format(selectedDate, 'dd')}</p>
                                                <p className="text-sm font-semibold">{format(selectedDate, 'MMM')}</p>
                                            </div>
                                            <div>
                                                <p className="font-semibold">{format(selectedDate, 'EEEE, yyyy')}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Select a date to see the schedule
                                                </p>
                                            </div>
                                        </div>
                                        <CalendarIcon className="h-6 w-6 opacity-50 text-destructive" />
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
