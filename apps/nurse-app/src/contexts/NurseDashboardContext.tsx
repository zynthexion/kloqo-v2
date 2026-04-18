'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { format } from 'date-fns';
import { Clinic, Doctor, Appointment, QueueState } from '@kloqo/shared';
import { useAuth } from './AuthContext';
import { apiRequest } from '@/lib/api-client';
import { useSSE, SSEPayload } from '@/hooks/use-sse';

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

  // ── Core data fetch ─────────────────────────────────────────────────────
  const fetchData = useCallback(async (isAutoRefresh = false) => {
    if (!clinicId) return;
    try {
      if (!isAutoRefresh) setLoading(true);

      const date = format(new Date(), 'yyyy-MM-dd');
      let dashData = await apiRequest<NurseDashboardData>(
        `/appointments/dashboard?clinicId=${clinicId}&date=${date}`
      );

      // Apply assigned-doctor filtering for nurse/receptionist users
      if (user?.assignedDoctorIds && user.assignedDoctorIds.length > 0) {
        const assignedIds = new Set(user.assignedDoctorIds);
        dashData = {
          ...dashData,
          doctors: (dashData.doctors || []).filter((doc: Doctor) => assignedIds.has(doc.id)),
          appointments: (dashData.appointments || []).filter((appt: Appointment) =>
            assignedIds.has(appt.doctorId)
          ),
        };
      }

      setData(dashData);
      setError(null);
    } catch (err: any) {
      console.error('[NurseDashboard] Fetch error:', err);
      setError(err.message);
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, [clinicId, user?.assignedDoctorIds]);

  // ── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (clinicId) {
      fetchData();
    } else {
      setData(null);
      setLoading(false);
    }
  }, [clinicId, fetchData]);

  // ── SSE: Real-time updates (replaces the old 30s setInterval poll) ───────
  // On any relevant SSE event from this clinic, we do a targeted state merge
  // rather than a full re-fetch, keeping the UX instant.
  useSSE({
    clinicId,
    onEvent: (event: SSEPayload) => {
      switch (event.type) {
        case 'appointment_status_changed': {
          const p = event.payload as {
            appointmentId: string;
            newStatus: string;
            tokenNumber?: string;
            classicTokenNumber?: string;
            isInBuffer?: boolean;
            slotIndex?: number;
          };
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              appointments: prev.appointments.map((apt) =>
                apt.id === p.appointmentId
                  ? {
                      ...apt,
                      status: p.newStatus as Appointment['status'],
                      tokenNumber: p.tokenNumber ?? apt.tokenNumber,
                      classicTokenNumber: p.classicTokenNumber ?? apt.classicTokenNumber,
                      isInBuffer: p.isInBuffer ?? apt.isInBuffer,
                      slotIndex: p.slotIndex ?? apt.slotIndex,
                    }
                  : apt
              ),
            };
          });
          break;
        }

        case 'walk_in_created': {
          // A new walk-in arrived — do a full refresh to get accurate queue order
          fetchData(true);
          break;
        }

        case 'doctor_status_changed': {
          const p = event.payload as { doctorId: string; status: string };
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              doctors: prev.doctors.map((doc) =>
                doc.id === p.doctorId
                  ? { ...doc, consultationStatus: p.status as Doctor['consultationStatus'] }
                  : doc
              ),
            };
          });
          break;
        }

        case 'break_scheduled':
        case 'break_cancelled':
        case 'session_started':
        case 'session_ended':
          // These are structural changes — safer to do a full refresh
          fetchData(true);
          break;

        default:
          break;
      }
    },
  });

  // ── Action handlers ──────────────────────────────────────────────────────
  const updateDoctorStatus = async (doctorId: string, status: 'In' | 'Out', sessionIndex?: number) => {
    try {
      await apiRequest(`/doctors/${doctorId}/consultation-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, sessionIndex }),
      });
      // SSE will push the change back; no manual re-fetch needed
    } catch (err: any) {
      console.error('[NurseDashboard] updateDoctorStatus error:', err);
      throw err;
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      await apiRequest(`/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      // SSE pushes the change back — no manual re-fetch needed
    } catch (err: any) {
      console.error('[NurseDashboard] updateAppointmentStatus error:', err);
      throw err;
    }
  };

  const completeWithPrescription = async (appointmentId: string, patientId: string, imageBlob: Blob) => {
    try {
      const imageCompression = (await import('browser-image-compression')).default;
      const compressedFile = await imageCompression(
        new File([imageBlob], 'prescription.jpg', { type: 'image/jpeg' }),
        { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true }
      );

      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('appointmentId', appointmentId);
      formData.append('patientId', patientId);

      await apiRequest('/prescriptions/upload', { method: 'POST', body: formData });
      await fetchData(true);
    } catch (err: any) {
      console.error('[NurseDashboard] completeWithPrescription error:', err);
      throw err;
    }
  };

  if (error === 'Clinic is not approved by Superadmin' || error === 'Clinic onboarding is incomplete') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/20">
        <div className="max-w-md p-8 bg-white border border-border shadow-lg rounded-xl text-center space-y-4">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Clinic Not Ready</h2>
          <p className="text-muted-foreground text-sm">
            {error}. Please contact your clinic administrator or complete the onboarding process in the Clinic Admin portal to access the clinical applications.
          </p>
        </div>
      </div>
    );
  }

  return (
    <NurseDashboardContext.Provider
      value={{
        data,
        loading,
        error,
        refresh: () => fetchData(false),
        updateDoctorStatus,
        updateAppointmentStatus,
        completeWithPrescription,
      }}
    >
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
