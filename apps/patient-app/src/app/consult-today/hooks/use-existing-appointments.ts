import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getClinicNow, getClinicDateString } from '@kloqo/shared-core';
import { apiRequest } from '@/lib/api-client';

export function useExistingAppointments(
    clinicId: string | null,
    user: any | null,
    permissionGranted: boolean
) {
    const router = useRouter();

    useEffect(() => {
        const checkExistingAppointments = async () => {
            if (!clinicId || !user?.patientId || permissionGranted) return;

            try {
                const today = getClinicDateString(getClinicNow());

                // Fetch patient data using REST API
                const patientData = await apiRequest(`/patients/${user.patientId}`);
                
                let allPatientIds = [user.patientId];
                if (patientData && patientData.relatedPatientIds && Array.isArray(patientData.relatedPatientIds)) {
                    allPatientIds = [user.patientId, ...patientData.relatedPatientIds].filter((id: any) => id);
                }

                // Prepare query parameters
                const params = new URLSearchParams({
                    clinicId: clinicId,
                    date: today,
                });
                
                // Add statuses
                ['Pending', 'Skipped', 'No-show'].forEach(status => params.append('status', status));
                
                // Add patient IDs (up to 30)
                allPatientIds.slice(0, 30).forEach(id => params.append('patientId', id));

                const appointments = await apiRequest(`/appointments?${params.toString()}`);
                
                if (appointments && appointments.length > 0) {
                    router.push(`/confirm-arrival?clinic=${clinicId}`);
                }
            } catch (error) {
                console.error('Error checking existing appointments:', error);
            }
        };

        if (user && clinicId) {
            checkExistingAppointments();
        }
    }, [clinicId, user, permissionGranted, router]);
}
