'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { format } from 'date-fns';
import { Clinic, Doctor, Appointment, QueueState, compareAppointments } from '@kloqo/shared';
import { getClinicISODateString, getClinicNow } from '@kloqo/shared-core';
import { useAuth } from './AuthContext';

import { apiRequest } from '@/lib/api-client';
import { useSSE, SSEPayload } from '@/hooks/use-sse';

interface NurseDashboardData {
  clinic: Clinic;
  doctors: Doctor[];
  appointments: Appointment[];
  queues: Record<string, QueueState>;
  currentTime: string;
  doctorAnalytics?: Record<string, {
    waitTimeTrend: number;
    todayGoalPercentage: number;
    completedCount: number;
    upcomingCount: number;
  }>;
}

interface NurseDashboardContextType {
  data: NurseDashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateDoctorStatus: (doctorId: string, status: 'In' | 'Out', sessionIndex?: number) => Promise<void>;
  updateAppointmentStatus: (appointmentId: string, status: string) => Promise<void>;
  completeWithPrescription: (appointmentId: string, patientId: string, fullBlob: Blob, inkBlob: Blob) => Promise<void>;
  selectedDoctorId: string | null;
  setSelectedDoctorId: (id: string) => void;
}

const NurseDashboardContext = createContext<NurseDashboardContextType | undefined>(undefined);

export function NurseDashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const clinicId = user?.clinicId;

  const [data, setData] = useState<NurseDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  // ── Core data fetch ─────────────────────────────────────────────────────

  const fetchData = useCallback(async (isAutoRefresh = false) => {
    if (!clinicId) return;
    try {
      const date = format(getClinicNow(), 'd MMMM yyyy');
      console.log(`[NurseDashboard] Fetching for clinic: ${clinicId}, date: ${date}`);
      
      let dashData = await apiRequest<NurseDashboardData>(
        `/appointments/dashboard?clinicId=${clinicId}&date=${date}`
      );

      console.log('[NurseDashboard] Raw API Doctors:', dashData.doctors?.map(d => ({ id: d.id, name: d.name })));

      // ─── DOCTOR/STAFF FILTERING (WORKING VERSION) ───────────────────────
      const activeRole = typeof window !== 'undefined' ? localStorage.getItem('activeRole') : null;
      const isDoctorRole = activeRole === 'doctor' || user?.role === 'doctor';

      let filteredDoctors = dashData.doctors || [];

      if (isDoctorRole) {
        // Doctors see themselves
        const myDoc = filteredDoctors.find((doc: Doctor) => doc.userId === user?.id || doc.userId === user?.uid);
        filteredDoctors = myDoc ? [myDoc] : (filteredDoctors.length > 0 ? [filteredDoctors[0]] : []);
        console.log('[NurseDashboard] Filtered for Doctor:', filteredDoctors.map(d => d.name));
      } else if (user?.assignedDoctorIds && user.assignedDoctorIds.length > 0) {
        // Staff see assigned doctors
        const assignedIds = new Set(user.assignedDoctorIds);
        console.log('[NurseDashboard] Staff Assignments:', user.assignedDoctorIds);
        filteredDoctors = filteredDoctors.filter((doc: Doctor) => assignedIds.has(doc.id));
        console.log('[NurseDashboard] Filtered for Staff:', filteredDoctors.map(d => d.name));
      }

      dashData = {
        ...dashData,
        doctors: filteredDoctors,
        appointments: (dashData.appointments || []).filter((appt: Appointment) =>
          appt && filteredDoctors.some(d => d.id === appt.doctorId)
        ).sort((a, b) => {
          if (!a || !b) return 0;
          if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "");
          return compareAppointments(a, b);
        }),
      };

      setData(dashData);
      setError(null);
    } catch (err: any) {
      console.error('[NurseDashboard] Fetch error:', err);
      setError(err.message);
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, [clinicId, user?.id, user?.uid, user?.role, user?.assignedDoctorIds]);

  // ── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[NurseDashboard] Tab visible, triggering refetch...');
        fetchData(true);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    if (clinicId) {
      fetchData();
    } else {
      setData(null);
      setLoading(false);
      setSelectedDoctorId(null);
    }

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clinicId, fetchData]);

  // Auto-select first doctor if none selected and data loaded
  useEffect(() => {
    if (data?.doctors.length && !selectedDoctorId) {
      console.log('[NurseDashboard] Auto-selecting doctor:', data.doctors[0].id);
      setSelectedDoctorId(data.doctors[0].id);
    } else if (data?.doctors.length && selectedDoctorId) {
       // Ensure selected doctor still exists in the list (assigned doctors check)
       if (!data.doctors.find(d => d.id === selectedDoctorId)) {
         setSelectedDoctorId(data.doctors[0].id);
       }
    }
  }, [data, selectedDoctorId]);

  // ── SSE: Real-time updates (replaces the old 30s setInterval poll) ───────
  useSSE({
    clinicId,
    onEvent: useCallback((event: SSEPayload) => {
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
                (apt && apt.id === p.appointmentId)
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
          const p = event.payload as { appointment: Appointment };
          setData((prev) => {
            if (!prev) return prev;
            if (prev.appointments.some(a => a && a.id === p.appointment?.id)) return prev;
            
            return {
              ...prev,
              appointments: [...prev.appointments, p.appointment].filter(Boolean).sort((a, b) => {
                if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "");
                return compareAppointments(a, b);
              })
            };
          });
          break;
        }

        case 'doctor_status_changed': {
          const p = event.payload as { doctorId: string; status: string };
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              doctors: prev.doctors.map((doc) =>
                (doc && doc.id === p.doctorId)
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
        case 'queue_reoptimized': {
          const p = event.payload as {
            doctorId: string;
            sessionIndex: number;
            updatedQueue: Appointment[];
          };
          setData((prev) => {
            if (!prev) return prev;
            const untouchedApts = prev.appointments.filter(a => 
              a && !(a.doctorId === p.doctorId && a.sessionIndex === p.sessionIndex)
            );
            return {
              ...prev,
              appointments: [...untouchedApts, ...(p.updatedQueue || [])].filter(Boolean).sort((a, b) => {
                if (!a || !b) return 0;
                if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "");
                return compareAppointments(a, b);
              })
            };
          });
          break;
        }

        default:
          break;
      }
    }, []),
  });

  // ── Action handlers ──────────────────────────────────────────────────────
  const refresh = useCallback(() => fetchData(false), [fetchData]);

  const updateDoctorStatus = useCallback(async (doctorId: string, status: 'In' | 'Out', sessionIndex?: number) => {
    try {
      await apiRequest(`/doctors/${doctorId}/consultation-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, sessionIndex }),
      });
    } catch (err: any) {
      console.error('[NurseDashboard] updateDoctorStatus error:', err);
      throw err;
    }
  }, []);

  const updateAppointmentStatus = useCallback(async (appointmentId: string, status: string) => {
    try {
      await apiRequest(`/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    } catch (err: any) {
      console.error('[NurseDashboard] updateAppointmentStatus error:', err);
      throw err;
    }
  }, []);

  const completeWithPrescription = useCallback(async (appointmentId: string, patientId: string, fullBlob: Blob, inkBlob: Blob) => {
    const appt = data?.appointments.find(a => a.id === appointmentId);
    const doctor = data?.doctors.find(d => d.id === (appt?.doctorId || selectedDoctorId));
    
    if (doctor?.consultationStatus === 'Out') {
      throw new Error(`Doctor ${doctor.name} is currently "Out". Please start session before completing.`);
    }

    try {
      const formData = new FormData();
      formData.append('fullFile', new File([fullBlob], 'prescription.png', { type: 'image/png' }));
      formData.append('inkFile', new File([inkBlob], 'ink.png', { type: 'image/png' }));
      formData.append('appointmentId', appointmentId);
      formData.append('patientId', patientId);

      await apiRequest('/prescriptions/upload', { method: 'POST', body: formData });
    } catch (err: any) {
      console.error('[NurseDashboard] completeWithPrescription error:', err);
      throw err;
    }
  }, [data?.appointments, data?.doctors, selectedDoctorId]);

  const handleSetSelectedDoctorId = useCallback((id: string) => {
    setSelectedDoctorId(id);
  }, []);

  const contextValue = useMemo(() => ({
    data,
    loading,
    error,
    refresh,
    updateDoctorStatus,
    updateAppointmentStatus,
    completeWithPrescription,
    selectedDoctorId,
    setSelectedDoctorId: handleSetSelectedDoctorId,
  }), [
    data, 
    loading, 
    error, 
    refresh, 
    updateDoctorStatus, 
    updateAppointmentStatus, 
    completeWithPrescription, 
    selectedDoctorId, 
    handleSetSelectedDoctorId
  ]);

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
    <NurseDashboardContext.Provider value={contextValue}>
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
