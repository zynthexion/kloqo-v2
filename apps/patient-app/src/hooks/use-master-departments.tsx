'use client';

import { useMemo } from 'react';
import useSWR from 'swr';

import { apiRequest } from '@/lib/api-client';

export interface Department {
  id: string;
  name: string;
  name_ml?: string;
  description?: string;
  description_ml?: string;
  icon?: string;
}

/**
 * useMasterDepartments
 * 
 * Fetches the master list of clinical departments from the V2 Backend.
 * Standardized to use the same logic as the nurse-app and clinic-admin.
 */
export function useMasterDepartments() {
  const { data, error, isLoading, mutate } = useSWR<any>(
    '/clinics/departments',
    apiRequest,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
    }
  );

  const departments: Department[] = useMemo(() => {
    if (Array.isArray(data)) return data;
    if (data?.departments) return data.departments;
    return [];
  }, [data]);

  return {
    departments,
    loading: isLoading,
    error,
    refresh: mutate,
  };
}

