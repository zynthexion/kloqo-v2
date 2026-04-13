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
import { getClinicTimeString, getClinicDayOfWeek, parseTime } from '@kloqo/shared-core';
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

    const selectedSlot = useMemo(() => slotISO ? new Date(slotISO) : null, [slotISO]);

    // Progressive loading from cache
    const cachedDoctor = useMemo(() => doctorId ? getDoctorFromCache(doctorId) : null, [doctorId]);
    const cachedPatient = useMemo(() => patientId ? getPatientFromCache(patientId) : null, [patientId]);

    const [doctor, setDoctor] = useState<Doctor | null>(cachedDoctor as any);
    const [patient, setPatient] = useState<Patient | null>(cachedPatient as any);
    const [clinicData, setClinicData] = useState<any | null>(null);
    const [loading, setLoading] = useState(!cachedDoctor || !cachedPatient);
    const [isSubmitting, setIsSubmitting] = useState(isWalkIn);
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
        if (!doctorId || !patientId) return;
        try {
            const [doctorRes, patientRes] = await Promise.all([
                apiRequest(`/doctors/${doctorId}`),
                apiRequest(`/patients/${patientId}`),
            ]);

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
                savePatientToCache(patientId, patientRes.patient);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [doctorId, patientId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleConfirmBooking = async () => {
        const effectiveDoctor = doctor || cachedDoctor;
        const effectivePatient = patient || cachedPatient;
        if (!effectiveDoctor || !effectivePatient || !selectedSlot || !user) return;

        setIsSubmitting(true);
        try {
            const appointmentDateStr = format(selectedSlot, "d MMMM yyyy");
            const slotTimeStr = getClinicTimeString(selectedSlot);

            const response = await apiRequest('/appointments/book-advanced', {
                method: 'POST',
                body: JSON.stringify({
                    clinicId: (effectiveDoctor as any).clinicId,
                    doctorId: (effectiveDoctor as any).id,
                    patientId: (effectivePatient as any).id,
                    date: appointmentDateStr,
                    slotTime: slotTimeStr,
                    bookedVia: 'Online',
                }),
            });

            if (response.appointment) {
                const b = response.appointment;
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
        t, language, router, isWalkIn, user
    };
}
