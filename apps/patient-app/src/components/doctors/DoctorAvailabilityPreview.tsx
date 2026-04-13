'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format, addDays, isSameDay, startOfDay, addMinutes, isBefore } from 'date-fns';
import { apiRequest } from '@/lib/api-client';
import { useBookingCapacity } from '@/hooks/use-booking-capacity';
import { useDebouncedTime } from '@/hooks/use-debounced-time';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { parseAppointmentDateTime } from '@/lib/utils';
import type { Doctor, Appointment } from '@kloqo/shared';

interface DoctorAvailabilityPreviewProps {
    doctor: Doctor;
}

export function DoctorAvailabilityPreview({ doctor }: DoctorAvailabilityPreviewProps) {
    const { t, language } = useLanguage();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
    const [allBookedSlots, setAllBookedSlots] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const currentTime = useDebouncedTime(120000);

    const availableDates = Array.from({ length: 3 }, (_, i) => addDays(new Date(), i))
        .filter(d => {
            const dayName = format(d, 'EEEE');
            return (doctor.availabilitySlots || []).some((s: any) => s.day === dayName);
        });

    const fetchSlots = useCallback(async (date: Date) => {
        if (!doctor.clinicId || !doctor.id) return;
        setLoading(true);
        try {
            const dateStr = format(date, 'd MMMM yyyy');
            const res = await apiRequest(`/appointments/public?clinicId=${doctor.clinicId}&doctorId=${doctor.id}&date=${encodeURIComponent(dateStr)}`);
            const apps: Appointment[] = res?.appointments || [];
            setAllAppointments(apps);
            setAllBookedSlots(apps.filter(a => !a.tokenNumber?.startsWith('W') && ['Pending', 'Confirmed', 'Completed'].includes(a.status)).map(a => parseAppointmentDateTime(a.date, a.time).getTime()));
        } catch (err) {
            console.error('Preview fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [doctor]);

    useEffect(() => {
        if (availableDates.length > 0) {
            const initialDate = availableDates.find(d => d >= startOfDay(new Date()));
            if (initialDate) {
                setSelectedDate(initialDate);
                fetchSlots(initialDate);
            }
        }
    }, [doctor.id]);

    const { sessionSlots } = useBookingCapacity({
        doctor,
        selectedDate,
        allAppointments,
        allBookedSlots,
        currentTime,
        t,
        language
    });

    // Correctly extract available slots by traversing subsessions
    const availableSlots = (sessionSlots || []).reduce((acc: any[], session) => {
        const sSlots = session.subsessions?.flatMap((ss: any) => ss.slots) || [];
        return [...acc, ...sSlots];
    }, []).filter((s: any) => s && s.status === 'available').slice(0, 4);




    return (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-4 h-4 text-theme-blue" />
                        Next Available Slots
                    </h3>
                    <div className="flex gap-2">
                        {availableDates.map(date => (
                            <button
                                key={date.toISOString()}
                                onClick={() => { setSelectedDate(date); fetchSlots(date); }}
                                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${
                                    isSameDay(selectedDate, date) 
                                    ? 'bg-theme-blue text-white shadow-lg shadow-theme-blue/20' 
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                }`}
                            >
                                {isSameDay(new Date(), date) ? 'Today' : format(date, 'EEE, d')}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-theme-blue/30" />
                    </div>
                ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                        {availableSlots.map((slot, idx) => (

                            <Link 
                                key={idx}
                                href={`/book-appointment?doctorId=${doctor.id}&slot=${slot.time.toISOString()}&date=${selectedDate.toISOString()}`}

                                className="group p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-theme-blue/30 hover:bg-white hover:shadow-xl transition-all"
                            >
                                <p className="text-lg font-black text-slate-800 group-hover:text-theme-blue transition-colors">
                                    {format(new Date(slot.time), 'hh:mm')}
                                    <span className="text-[10px] ml-1 uppercase opacity-50">{format(new Date(slot.time), 'a')}</span>
                                </p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Pick this slot</p>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No slots available</p>
                        <p className="text-[10px] font-medium text-slate-300 mt-1 uppercase">Try another date</p>
                    </div>
                )}

                <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Queue length</p>
                        <p className="text-sm font-bold text-slate-800">Low wait time expected</p>
                    </div>
                    <Button variant="ghost" asChild className="group h-10 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest text-theme-blue hover:bg-theme-blue/5">
                        <Link href={`/book-appointment?doctorId=${doctor.id}`}>
                            All Slots
                            <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
