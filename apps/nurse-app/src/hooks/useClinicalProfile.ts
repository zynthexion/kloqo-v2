'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api-client';
import type { Doctor } from '@kloqo/shared';

export function useClinicalProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      // If user is not potentially a doctor, skip (Optimization)
      const roles = user.roles || (user.role ? [user.role] : []);
      if (!roles.includes('doctor') && !roles.includes('clinicAdmin')) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Step 1: Query by User UID (Identity-Based)
        // We use GetDoctorDetails endpoint which already has our Read-Repair/Identity logic
        const data = await apiRequest<{ doctor: Doctor }>(`/doctors/${user.id}`);
        setProfile(data.doctor);
      } catch (err: any) {
        console.warn('[useClinicalProfile] No clinical profile found for this identity:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

  return { profile, loading, error };
}
