import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api-client';
import { useLanguage } from '@/contexts/language-context';
import type { Doctor } from '@kloqo/shared';
import { 
    getClinicDayOfWeek, 
    getClinicNow, 
    getClinicDateString, 
    getClinicTimeString,
    calculateWalkInDetails
} from '@kloqo/shared-core';
import { isWithinBookingWindow } from '@/lib/utils';
import { FormValues } from '@kloqo/shared';

export function useBooking(selectedDoctor: Doctor, appointmentType: 'Walk-in' | 'Online') {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { toast } = useToast();
    const { t } = useLanguage();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tokenDistribution, setTokenDistribution] = useState<'classic' | 'advanced'>('classic');
    const [clinicDetails, setClinicDetails] = useState<any | null>(null);

    const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [estimatedConsultationTime, setEstimatedConsultationTime] = useState<Date | null>(null);
    const [patientsAhead, setPatientsAhead] = useState(0);
    const [walkInData, setWalkInData] = useState<any>(null);
    const [hasRecalculated, setHasRecalculated] = useState(false);

    useEffect(() => {
        const fetchClinicInfo = async () => {
            if (!selectedDoctor.clinicId) return;
            try {
                const data = await apiRequest(`/clinics/${selectedDoctor.clinicId}`);
                if (data) {
                    setTokenDistribution(data.tokenDistribution || 'classic');
                    setClinicDetails(data);
                }
            } catch (e) {
                console.warn('Failed to fetch clinic info in PatientForm:', e);
            }
        };
        fetchClinicInfo();
    }, [selectedDoctor.clinicId]);

    const ensureDoctorAvailabilityForToday = () => {
        if (!selectedDoctor?.availabilitySlots?.length) {
            return { hasSlots: false as const };
        }

        const clinicNow = getClinicNow();
        const todayDay = getClinicDayOfWeek(clinicNow);
        const todaysAvailability = selectedDoctor.availabilitySlots.find(slot => String(slot.day) === String(todayDay));

        if (!todaysAvailability || !todaysAvailability.timeSlots?.length) {
            return { hasSlots: false as const };
        }

        return { hasSlots: true as const };
    };

    const handleConfirmWalkIn = async () => {
        if (!walkInData || !user?.phone) return;
        
        setIsSubmitting(true);
        setIsEstimateModalOpen(false);

        const { patientId, formData } = walkInData;

        const params = new URLSearchParams();
        params.set('doctorId', selectedDoctor.id);
        params.set('patientId', patientId);
        params.set('name', formData.name);
        params.set('age', String(formData.age));
        params.set('sex', formData.sex);
        params.set('place', formData.place);
        params.set('phone', formData.phone || user.phone);
        params.set('isWalkIn', 'true');

        router.push(`/book-appointment/summary?${params.toString()}`);
        setIsSubmitting(false);
    };

    const onSubmitBooking = async (data: FormValues, selectedPatientId: string) => {
        setIsSubmitting(true);
        const { name, age, sex, place, phone } = data;
        const computedPhone = phone && phone.length > 0 ? (phone.startsWith('+91') ? phone : `+91${phone}`) : user?.phone;

        try {
            if (appointmentType === 'Walk-in') {
                const todaysAvailability = ensureDoctorAvailabilityForToday();
                if (!todaysAvailability.hasSlots) {
                    toast({
                        variant: "destructive",
                        title: t.consultToday.bookingFailed,
                        description: t.consultToday.noWalkInSlotsAvailableToday,
                    });
                    setIsSubmitting(false);
                    return;
                }

                if (!isWithinBookingWindow(selectedDoctor, tokenDistribution)) {
                    toast({
                        variant: "destructive",
                        title: t.consultToday.bookingFailed,
                        description: `Dr. ${selectedDoctor.name} ${t.consultToday.doctorNotAvailableWalkIn}`,
                    });
                    setIsSubmitting(false);
                    return;
                }

                // Redirect to summary for walk-in confirmation
                const params = new URLSearchParams();
                params.set('doctorId', selectedDoctor.id);
                params.set('patientId', selectedPatientId);
                params.set('name', name);
                params.set('age', String(age));
                params.set('sex', sex);
                params.set('place', place);
                params.set('phone', computedPhone || '');
                params.set('isWalkIn', 'true');
                router.push(`/book-appointment/summary?${params.toString()}`);
            } else {
                const slotISO = searchParams.get('slot');
                if (!slotISO) {
                    toast({
                        variant: 'destructive',
                        title: t.bookAppointment.error,
                        description: "No slot selected."
                    });
                    setIsSubmitting(false);
                    return;
                }

                // Redirect to summary for online confirmation
                const params = new URLSearchParams();
                params.set('doctorId', selectedDoctor.id);
                params.set('patientId', selectedPatientId);
                params.set('name', name);
                params.set('age', String(age));
                params.set('sex', sex);
                params.set('place', place);
                params.set('phone', computedPhone || '');
                params.set('slot', slotISO);
                params.set('slotIndex', searchParams.get('slotIndex') || '');
                params.set('sessionIndex', searchParams.get('sessionIndex') || '');
                
                router.push(`/book-appointment/summary?${params.toString()}`);
            }
        } catch (error: any) {
            console.error('[PF:SUBMIT] ❌ Navigation failed:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        isSubmitting,
        isEstimateModalOpen,
        setIsEstimateModalOpen,
        isTokenModalOpen,
        setIsTokenModalOpen,
        generatedToken,
        estimatedConsultationTime,
        patientsAhead,
        walkInData,
        setWalkInData,
        handleConfirmWalkIn,
        onSubmitBooking,
        clinicDetails
    };
}
