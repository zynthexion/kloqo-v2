'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { format } from 'date-fns';
import { Clinic, Doctor, Appointment, QueueState } from '@kloqo/shared';
import { useAuth } from './AuthContext';
import { useSSE } from '@/hooks/use-sse';

import { apiRequest } from '@/lib/api-client';

interface NurseDashboardData {
  clinic: Clinic;
  doctors: Doctor[];
  appointments: Appointment[];
  queues: Record<string, QueueState>;
  currentTime: string;
}

interface NurseDashboardContextType {
  data: NurseDashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateDoctorStatus: (doctorId: string, status: 'In' | 'Out', sessionIndex?: number) => Promise<void>;
  updateAppointmentStatus: (appointmentId: string, status: string) => Promise<void>;
  completeWithPrescription: (appointmentId: string, patientId: string, imageBlob: Blob) => Promise<void>;
}

const NurseDashboardContext = createContext<NurseDashboardContextType | undefined>(undefined);

export function NurseDashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const clinicId = user?.clinicId;
  
  const [data, setData] = useState<NurseDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isAutoRefresh = false) => {
    if (!clinicId) return;

    try {
      if (!isAutoRefresh) setLoading(true);
      
      const date = format(new Date(), 'd MMMM yyyy');
      
      let dashData = await apiRequest<NurseDashboardData>(
        `/appointments/dashboard?clinicId=${clinicId}&date=${date}`
      );
      
      // Apply assigned doctor filtering if the user has specific assignments
      if (user?.assignedDoctorIds && user.assignedDoctorIds.length > 0) {
        const assignedIds = new Set(user.assignedDoctorIds);
        
        dashData = {
          ...dashData,
          doctors: (dashData.doctors || []).filter((doc: Doctor) => assignedIds.has(doc.id)),
          appointments: (dashData.appointments || []).filter((appt: Appointment) => assignedIds.has(appt.doctorId))
        };
      }

      setData(dashData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching dashboard:', err);
      setError(err.message);
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, [clinicId, user?.assignedDoctorIds]);

  // Initial fetch
  useEffect(() => {
    if (clinicId) {
      fetchData();
    } else {
      setData(null);
      setLoading(false);
    }
  }, [clinicId, fetchData]);

  // SSE: Real-time updates instead of 30s polling
  useSSE({
    clinicId: clinicId,
    onEvent: useCallback((event) => {
      if (['appointment_status_changed', 'token_called', 'queue_updated', 'walk_in_created', 'session_ended', 'session_started'].includes(event.type)) {
        fetchData(true);
      }
    }, [fetchData])
  });

  const updateDoctorStatus = async (doctorId: string, status: 'In' | 'Out', sessionIndex?: number) => {
    try {
      await apiRequest(`/doctors/${doctorId}/consultation-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, sessionIndex })
      });

      await fetchData(true);
    } catch (err: any) {
      console.error('Error updating status:', err);
      throw err;
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      await apiRequest(`/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      await fetchData(true);
    } catch (err: any) {
      console.error('Error updating appointment status:', err);
      throw err;
    }
  };

  const completeWithPrescription = async (appointmentId: string, patientId: string, imageBlob: Blob) => {
    try {
      // Step 1: Compress (Client-Side)
      // Dynamic import to avoid SSR issues if any
      const imageCompression = (await import('browser-image-compression')).default;
      
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      };

      const compressedFile = await imageCompression(new File([imageBlob], "prescription.jpg", { type: "image/jpeg" }), options);

      // Step 2 & 3: Upload & Metadata Link (via Backend)
      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('appointmentId', appointmentId);
      formData.append('patientId', patientId);

      await apiRequest('/prescriptions/upload', {
        method: 'POST',
        body: formData
      });

      await fetchData(true);
    } catch (err: any) {
      console.error('Error completing appointment with prescription:', err);
      throw err;
    }
  };

  return (
    <NurseDashboardContext.Provider value={{ 
      data, 
      loading, 
      error, 
      refresh: () => fetchData(false), 
      updateDoctorStatus, 
      updateAppointmentStatus,
      completeWithPrescription 
    }}>
      {children}
    </NurseDashboardContext.Provider>
  );
}

export function useNurseDashboardContext() {
  const context = useContext(NurseDashboardContext);
  if (context === undefined) {
    throw new Error('useNurseDashboardContext must be used within a NurseDashboardProvider');
  }
  return context;
}
