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

        if (!hasRecalculated) {
            try {
                // In V2, we should have an endpoint for this recalculation.
                setHasRecalculated(true);
            } catch (recalcError: any) {
                console.error(`[WALK-IN DEBUG] Error during pre-confirmation recalculation:`, recalcError);
                setHasRecalculated(true); 
            }
        }

        const { patientId, formData } = walkInData;

        try {
            const result = await apiRequest('/appointments/walk-in', {
                method: 'POST',
                body: JSON.stringify({
                    patientId,
                    doctorId: selectedDoctor.id,
                    clinicId: selectedDoctor.clinicId,
                    patientName: formData.name,
                    age: formData.age,
                    sex: formData.sex,
                    place: formData.place,
                    phone: formData.phone || user.phone,
                    date: getClinicDateString(getClinicNow())
                }),
            });

            if (result?.patientsAhead !== undefined) {
                setPatientsAhead(result.patientsAhead);
            }
            if (result?.estimatedTime) {
                setEstimatedConsultationTime(new Date(result.estimatedTime));
            }
            if (result?.tokenNumber) {
                setGeneratedToken(result.tokenNumber);
            }

            const params = new URLSearchParams();
            params.set('doctorId', selectedDoctor.id);
            params.set('patientId', patientId);
            params.set('appointmentId', result.appointmentId);
            params.set('isWalkIn', 'true');
            params.set('slot', result.estimatedTime);

            router.push(`/book-appointment/summary?${params.toString()}`);

        } catch (error) {
            console.error('[WALK-IN DEBUG] API booking failed', error);
            const err = error as Error;
            toast({
                variant: 'destructive',
                title: t.bookAppointment.error,
                description: err?.message || t.bookAppointment.bookingFailed,
            });
        } finally {
            setIsSubmitting(false);
        }
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

                const walkInResponse = await apiRequest('/appointments/walk-in', {
                    method: 'POST',
                    body: JSON.stringify({
                        doctorId: selectedDoctor.id,
                        clinicId: selectedDoctor.clinicId,
                        patientId: selectedPatientId !== 'new' ? selectedPatientId : undefined,
                        patientName: name,
                        age,
                        sex,
                        place,
                        phone: computedPhone,
                        date: getClinicDateString(getClinicNow())
                    })
                });

                if (walkInResponse.tokenNumber) {
                    setGeneratedToken(walkInResponse.tokenNumber);
                    const params = new URLSearchParams();
                    params.set('doctorId', selectedDoctor.id);
                    params.set('patientId', walkInResponse.patientId);
                    params.set('appointmentId', walkInResponse.id);
                    params.set('isWalkIn', 'true');
                    params.set('slot', walkInResponse.arriveByTime);
                    router.push(`/book-appointment/summary?${params.toString()}`);
                }
            } else {
                const slotISO = searchParams.get('slot');
                const selectedSlot = slotISO ? new Date(slotISO) : null;
                
                if (!selectedSlot) {
                     toast({
                        variant: 'destructive',
                        title: t.bookAppointment.error,
                        description: "No slot selected."
                    });
                    setIsSubmitting(false);
                    return;
                }

                const onlineResponse = await apiRequest('/appointments/advanced', {
                    method: 'POST',
                    body: JSON.stringify({
                        doctorId: selectedDoctor.id,
                        clinicId: selectedDoctor.clinicId,
                        patientId: selectedPatientId !== 'new' ? selectedPatientId : undefined,
                        patientName: name,
                        age,
                        sex,
                        place,
                        phone: computedPhone,
                        date: getClinicDateString(selectedSlot),
                        slotIndex: searchParams.get('slotIndex') ? parseInt(searchParams.get('slotIndex')!) : undefined,
                        sessionIndex: searchParams.get('sessionIndex') ? parseInt(searchParams.get('sessionIndex')!) : undefined,
                        time: getClinicTimeString(selectedSlot),
                        source: 'app'
                    })
                });

                const params = new URLSearchParams();
                params.set('doctorId', selectedDoctor.id);
                params.set('patientId', onlineResponse.patientId);
                params.set('appointmentId', onlineResponse.id);
                params.set('slot', onlineResponse.time);
                router.push(`/book-appointment/summary?${params.toString()}`);
            }
        } catch (error: any) {
            console.error('[PF:SUBMIT] ❌ API call failed:', error);
            toast({
                variant: 'destructive',
                title: t.bookAppointment.bookingFailed,
                description: error.message
            });
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
