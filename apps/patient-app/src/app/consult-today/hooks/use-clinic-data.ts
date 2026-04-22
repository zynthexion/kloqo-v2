import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { Doctor } from '@kloqo/shared';

export interface Clinic {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    tokenDistribution?: 'classic' | 'advanced';
}

export function useClinicData(clinicId: string | null) {
    const [clinic, setClinic] = useState<Clinic | null>(null);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [doctorsLoading, setDoctorsLoading] = useState(true);

    useEffect(() => {
        const fetchClinic = async () => {
            if (!clinicId) return;

            try {
                const todayStr = new Date().toISOString().split('T')[0]; // Simple local today str, backend will normalize
                const context = await apiRequest<any>(`/public-booking/clinics/${clinicId}?date=${todayStr}`);
                
                if (context?.clinic) {
                    setClinic({
                        id: context.clinic.id,
                        name: context.clinic.name || '',
                        latitude: context.clinic.latitude || 0,
                        longitude: context.clinic.longitude || 0,
                        tokenDistribution: context.clinic.settings?.allowOnlineBooking ? 'advanced' : 'classic'
                    });
                }
                
                if (context?.doctors) {
                    setDoctors(context.doctors);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setDoctorsLoading(false);
            }
        };

        fetchClinic();
    }, [clinicId]);

    return { clinic, setClinic, doctors, doctorsLoading };
}
