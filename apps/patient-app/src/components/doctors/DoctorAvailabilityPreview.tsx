'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { apiRequest } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ChevronRight, Loader2 } from 'lucide-react';
import type { Doctor } from '@kloqo/shared';
import { getClinicNow } from '@kloqo/shared-core';

interface DoctorAvailabilityPreviewProps {
    doctor: Doctor;
}

/**
 * DoctorAvailabilityPreview
 *
 * Shows a quick "Next Available Slots" card for a given doctor on the home page.
 * Fully backed by the /appointments/public/available-slots endpoint — all logic
 * (buffer, 85/15 reserve, break hiding) is enforced by the backend.
 *
 * Patients see the first available slot per session (density-first; no session hiding).
 */
export function DoctorAvailabilityPreview({ doctor }: DoctorAvailabilityPreviewProps) {
    const { t } = useLanguage();
    const [selectedDate, setSelectedDate] = useState<Date>(getClinicNow());
    const [backendSlots, setBackendSlots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Show the next 3 days the doctor is available
    const availableDates = Array.from({ length: 7 }, (_, i) => addDays(getClinicNow(), i))
        .filter(d => {
            const dayName = format(d, 'EEEE');
            return (doctor.availabilitySlots || []).some((s: any) => s.day === dayName);
        })
        .slice(0, 3);

    const fetchSlots = useCallback(async (date: Date) => {
        if (!doctor.clinicId || !doctor.id) return;
        setLoading(true);
        try {
            const dateStr = format(date, 'yyyy-MM-dd');
            const data = await apiRequest<any[]>(
                `/public-booking/doctors/${doctor.id}/slots?clinicId=${doctor.clinicId}&date=${encodeURIComponent(dateStr)}`
            );
            setBackendSlots(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Preview fetch error:', err);
            setBackendSlots([]);
        } finally {
            setLoading(false);
        }
    }, [doctor.clinicId, doctor.id]);

    useEffect(() => {
        const initialDate = availableDates.find(d => d >= startOfDay(getClinicNow()));
        if (initialDate) {
            setSelectedDate(initialDate);
            fetchSlots(initialDate);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doctor.id]);

    // Collect up to 4 available first-slots (one per session)
    const sessionMap = new Map<number, any>();
    backendSlots.forEach(slot => {
        if (slot.status === 'available' && !sessionMap.has(slot.sessionIndex)) {
            sessionMap.set(slot.sessionIndex, slot);
        }
    });
    const previewSlots = Array.from(sessionMap.values()).slice(0, 4);

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
                                {isSameDay(getClinicNow(), date) ? 'Today' : format(date, 'EEE, d')}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-theme-blue/30" />
                    </div>
                ) : previewSlots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                        {previewSlots.map((slot, idx) => (
                            <Link
                                key={idx}
                                href={`/book-appointment?doctorId=${doctor.id}&slot=${new Date(slot.time).toISOString()}&slotIndex=${slot.slotIndex}&sessionIndex=${slot.sessionIndex}&date=${format(selectedDate, 'yyyy-MM-dd')}`}
                                className="group p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-theme-blue/30 hover:bg-white hover:shadow-xl transition-all"
                            >
                                <p className="text-lg font-black text-slate-800 group-hover:text-theme-blue transition-colors">
                                    {format(new Date(slot.time), 'hh:mm')}
                                    <span className="text-[10px] ml-1 uppercase opacity-50">{format(new Date(slot.time), 'a')}</span>
                                </p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Session {slot.sessionIndex + 1}</p>
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
