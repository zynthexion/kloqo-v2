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
                const [clinicData, doctorsData] = await Promise.all([
                    apiRequest(`/clinics/${clinicId}`),
                    apiRequest(`/doctors?clinicId=${clinicId}`)
                ]);
                
                if (clinicData) {
                    setClinic({
                        id: clinicData.id,
                        name: clinicData.name || '',
                        latitude: clinicData.latitude || 0,
                        longitude: clinicData.longitude || 0,
                        tokenDistribution: clinicData.tokenDistribution || 'classic'
                    });
                }
                
                if (doctorsData?.doctors) {
                    setDoctors(doctorsData.doctors);
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
