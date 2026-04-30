'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { format, subMinutes, addMinutes, parse } from 'date-fns';
import { apiRequest } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/language-context';
import { getDoctorFromCache, saveDoctorToCache } from '@/lib/doctor-cache';
import { getPatientFromCache, savePatientToCache } from '@/lib/patient-cache';
import { getClinic12hTimeString, getClinicDayOfWeek, parseTime, getClinicDateString, getClinicISOString } from '@kloqo/shared-core';
import type { Doctor, Patient, Appointment } from '@kloqo/shared';

/**
 * useBookingSummaryState
 * Logic for fetching doctor/patient details, orchestrating the booking flow,
 * and handling success state transitions.
 */
export function useBookingSummaryState() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { toast } = useToast();
    const { t, language } = useLanguage();

    const doctorId = searchParams.get('doctorId');
    const slotISO = searchParams.get('slot');
    const patientId = searchParams.get('patientId');
    const isWalkIn = searchParams.get('isWalkIn') === 'true';
    const appointmentId = searchParams.get('appointmentId');

    // 3A. Overrideable Slot State (for auto-fixing conflicts)
    const [currentSlotISO, setCurrentSlotISO] = useState<string | null>(slotISO);
    const [currentSlotIndex, setCurrentSlotIndex] = useState<number | null>(
        searchParams.get('slotIndex') ? parseInt(searchParams.get('slotIndex')!) : null
    );
    const [currentSessionIndex, setCurrentSessionIndex] = useState<number | null>(
        searchParams.get('sessionIndex') ? parseInt(searchParams.get('sessionIndex')!) : null
    );
    const [isPulsating, setIsPulsating] = useState(false);

    const selectedSlot = useMemo(() => {
        if (!currentSlotISO) return null;
        const d = new Date(currentSlotISO);
        if (!isNaN(d.getTime())) return d;
        return null;
    }, [currentSlotISO]);

    // Progressive loading from cache or URL params
    const cachedDoctor = useMemo(() => doctorId ? getDoctorFromCache(doctorId) : null, [doctorId]);
    const cachedPatient = useMemo(() => patientId && patientId !== 'new' ? getPatientFromCache(patientId) : null, [patientId]);

    const urlPatientData = useMemo(() => ({
        name: searchParams.get('name'),
        age: searchParams.get('age'),
        sex: searchParams.get('sex'),
        place: searchParams.get('place'),
        phone: searchParams.get('phone')
    }), [searchParams]);

    const [doctor, setDoctor] = useState<Doctor | null>(cachedDoctor as any);
    const [patient, setPatient] = useState<Patient | null>(() => {
        if (patientId === 'new' || (patientId && urlPatientData.name)) {
            return {
                id: patientId || 'new',
                name: urlPatientData.name || '',
                age: urlPatientData.age ? parseInt(urlPatientData.age) : undefined,
                sex: urlPatientData.sex as any,
                place: urlPatientData.place || '',
                phone: urlPatientData.phone || ''
            } as any;
        }
        return cachedPatient as any;
    });

    const [clinicData, setClinicData] = useState<any | null>(null);
    const [loading, setLoading] = useState(!cachedDoctor || (!cachedPatient && patientId !== 'new' && !urlPatientData.name));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<'summary' | 'success'>('summary');
    
    // Success States
    const [bookingDetails, setBookingDetails] = useState<{
        token: string;
        date: string;
        time: string;
        arriveBy: string;
        id: string;
        noShowTime: Date | null;
        patientsAhead?: number;
    } | null>(null);

    const fetchData = useCallback(async () => {
        if (!doctorId) return;
        try {
            const promises: Promise<any>[] = [apiRequest(`/doctors/${doctorId}`)];
            if (patientId && patientId !== 'new' && !urlPatientData.name) {
                promises.push(apiRequest(`/patients/${patientId}`));
            }

            const [doctorRes, patientRes] = await Promise.all(promises);

            if (doctorRes?.doctor) {
                setDoctor(doctorRes.doctor);
                saveDoctorToCache(doctorId, doctorRes.doctor);
                if (doctorRes.doctor.clinicId) {
                    apiRequest(`/clinics/${doctorRes.doctor.clinicId}`).then(res => {
                        if (res?.clinic) setClinicData(res.clinic);
                    }).catch(() => {});
                }
            }

            if (patientRes?.patient) {
                setPatient(patientRes.patient);
                if (patientId) {
                    savePatientToCache(patientId, patientRes.patient);
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [doctorId, patientId, urlPatientData.name]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleConfirmBooking = async () => {
        const effectiveDoctor = doctor || cachedDoctor;
        if (!effectiveDoctor || !user) return;

        const bookingPayload = {
            clinicId: (effectiveDoctor as any).clinicId,
            doctorId: (effectiveDoctor as any).id,
            patientId: patientId !== 'new' ? patientId : undefined,
            patientName: urlPatientData.name,
            age: urlPatientData.age ? parseInt(urlPatientData.age) : undefined,
            sex: urlPatientData.sex,
            place: urlPatientData.place,
            phone: urlPatientData.phone,
            rescheduleFromId: appointmentId || undefined,
        };

        setIsSubmitting(true);
        try {
            let response;
            if (isWalkIn) {
                response = await apiRequest('/appointments/walk-in', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...bookingPayload,
                        date: getClinicDateString() // Use date-utils format eventually
                    }),
                });
            } else {
                if (!selectedSlot) throw new Error("Slot selection missing");
                const appointmentDateStr = getClinicDateString(selectedSlot);
                const slotTimeStr = getClinic12hTimeString(selectedSlot);

                response = await apiRequest('/appointments/advanced', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...bookingPayload,
                        date: appointmentDateStr,
                        slotTime: slotTimeStr,
                        slotIndex: currentSlotIndex,
                        sessionIndex: currentSessionIndex,
                        source: 'app',
                    }),
                });
            }

            if (response.appointment || response.id) {
                const b = response.appointment || response;
                setBookingDetails({
                    token: b.tokenNumber,
                    date: b.date,
                    time: b.time,
                    arriveBy: b.arriveByTime ?? b.time,
                    id: b.id,
                    noShowTime: b.noShowTime ? new Date(b.noShowTime?.seconds * 1000 || b.noShowTime) : null
                });
                setStatus('success');
            }
        } catch (error: any) {
            if (error.status === 409 && selectedSlot) {
                // AUTO-FIX CONFLICT: Find next available slot
                try {
                    const dateStr = getClinicISOString(selectedSlot);
                    const clinicId = (effectiveDoctor as any).clinicId;
                    const slots = await apiRequest<any[]>(`/public-booking/doctors/${effectiveDoctor.id}/slots?clinicId=${clinicId}&date=${dateStr}`);
                    
                    const nextAvailable = slots.find((s: any) => s.status === 'available' && s.isAvailable);
                    if (nextAvailable) {
                        setCurrentSlotISO(nextAvailable.time);
                        setCurrentSlotIndex(nextAvailable.slotIndex);
                        setCurrentSessionIndex(nextAvailable.sessionIndex);
                        
                        setIsPulsating(true);
                        setTimeout(() => setIsPulsating(false), 3000);

                        toast({ 
                            title: "Slot already taken", 
                            description: "Someone just booked that slot! We've picked the next available one for you. Please click Book again.",
                            duration: 5000
                        });
                        return; // Stop here, let user click again
                    }
                } catch (retryErr) {
                    console.error('Failed to find next available slot:', retryErr);
                }
            }
            toast({ variant: 'destructive', title: t.bookAppointment.error, description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        doctor: doctor || (cachedDoctor as any),
        patient: patient || (cachedPatient as any),
        clinicData,
        selectedSlot,
        loading,
        isSubmitting,
        status,
        bookingDetails,
        handleConfirmBooking,
        isPulsating,
        t, language, router, isWalkIn, user
    };
}
