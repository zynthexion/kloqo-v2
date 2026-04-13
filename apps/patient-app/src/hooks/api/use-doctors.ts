'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { Doctor } from '@kloqo/shared';

/**
 * useDoctors (V2 REST Bridge)
 * Fetches doctors via the backend API.
 */
export function useDoctors(clinicIds?: string[]) {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const fetchDoctors = async () => {
            setLoading(true);
            try {
                let url = '/doctors';
                if (clinicIds && clinicIds.length > 0) {
                    url += `?clinicIds=${clinicIds.join(',')}`;
                }
                const res = await apiRequest(url);
                const data = Array.isArray(res) ? res : (res.data || []);
                setDoctors(data);
                setError(null);
            } catch (err: any) {
                console.error('Error fetching doctors:', err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchDoctors();
    }, [clinicIds]);

    return { doctors, loading, error };
}
