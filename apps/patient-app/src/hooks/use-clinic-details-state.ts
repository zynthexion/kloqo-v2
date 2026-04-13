'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';
import type { Clinic, Doctor } from '@kloqo/shared';

/**
 * useClinicDetailsState
 * Logic for fetching clinic meta-data and its associated medical staff via REST.
 * Isolates Firestore-specific query logic to the V2 backend.
 */
export function useClinicDetailsState() {
  const params = useParams();
  const clinicId = params.id as string;

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      // Parallel fetch for clinic profile and staff list
      const [clinicData, doctorsData] = await Promise.all([
        apiRequest<Clinic>(`/clinics/${clinicId}`),
        apiRequest<Doctor[]>(`/clinics/${clinicId}/doctors`)
      ]);
      
      setClinic(clinicData);
      setDoctors(doctorsData || []);
    } catch (error) {
      console.error('Failed to fetch clinic details:', error);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    clinic,
    doctors,
    loading,
    clinicId
  };
}
