'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { Appointment } from '@kloqo/shared';

/**
 * useAppointments (V2 REST Bridge)
 * Fetches appointments for a specific patient via the backend API.
 */
export function useAppointments(patientId?: string) {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!patientId) {
            setLoading(false);
            return;
        }

        const fetchAppointments = async () => {
            setLoading(true);
            try {
                const res = await apiRequest(`/appointments?patientId=${patientId}`);
                // Handle V2 response { appointments: [...] } or direct array
                const data = res.appointments || (Array.isArray(res) ? res : (res.data || []));
                setAppointments(data);
                setError(null);
            } catch (err: any) {
                console.error('Error fetching appointments:', err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAppointments();
    }, [patientId]);

    return { appointments, loading, error };
}
