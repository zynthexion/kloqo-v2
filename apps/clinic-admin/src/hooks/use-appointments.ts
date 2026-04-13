'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api-client';
import type { Appointment, Doctor } from '@kloqo/shared';
import { useToast } from '@/hooks/use-toast';
import { useSSE } from './use-sse';

export function useAppointments() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinicDetails, setClinicDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!currentUser?.clinicId) return;

    if (!silent) setLoading(true);
    try {
      const [appointmentsData, doctorsData, clinicData] = await Promise.all([
        apiRequest<Appointment[]>('/clinic/appointments'),
        apiRequest<Doctor[]>('/clinic/doctors'),
        apiRequest<any>('/clinic/me')
      ]);

      const safeAppointments = Array.isArray(appointmentsData) ? appointmentsData : ((appointmentsData as any)?.data || []);
      const safeDoctors = Array.isArray(doctorsData) ? doctorsData : ((doctorsData as any)?.data || []);

      setAppointments(safeAppointments);
      setDoctors(safeDoctors);
      setClinicDetails(clinicData || null);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching appointments data:', err);
      setError(err.message || 'Failed to fetch data');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to fetch appointments data'
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentUser?.clinicId, toast]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SSE: Listen for real-time updates from the backend
  const handleSSEEvent = useCallback((event: any) => {
    if (['appointment_status_changed', 'walk_in_created', 'queue_updated'].includes(event.type)) {
      fetchData(true); // Silent refresh when underlying data changes
    }
  }, [fetchData]);

  useSSE({
    clinicId: currentUser?.clinicId,
    onEvent: handleSSEEvent,
  });

  // ✅ FIX: Wrap all utility functions in useCallback to prevent them from being
  // recreated on every render. Without this, any downstream useEffect that depends
  // on these functions (e.g., in useAppointmentsPage) would re-run on every parent render.

  const searchPatients = useCallback(async (phone: string) => {
    if (!currentUser?.clinicId) return [];
    try {
      return await apiRequest<any[]>(`/patients/search?phone=${phone}&clinicId=${currentUser.clinicId}`);
    } catch (err: any) {
      console.error('Error searching patients:', err);
      return [];
    }
  }, [currentUser?.clinicId]);

  const getPatientById = useCallback(async (id: string) => {
    if (!currentUser?.clinicId) return null;
    try {
      const results = await apiRequest<any[]>(`/patients/search?id=${id}&clinicId=${currentUser.clinicId}`);
      return results && results.length > 0 ? results[0] : null;
    } catch (err: any) {
      console.error('Error getting patient by id:', err);
      return null;
    }
  }, [currentUser?.clinicId]);

  const updateStatus = useCallback(async (appointmentId: string, status: Appointment['status'], time?: string, isPriority?: boolean) => {
    try {
      const updated = await apiRequest(`/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, time, isPriority })
      });

      // Update local state immediately (optimistic update)
      setAppointments(prev =>
        prev.map(a => a.id === appointmentId ? { ...a, status, isPriority: isPriority ?? a.isPriority } : a)
      );

      return updated;
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: err.message || 'Failed to update appointment status'
      });
      throw err;
    }
  }, [toast]);

  const bookAppointment = useCallback(async (values: any) => {
    try {
      const appointment = await apiRequest('/appointments/book', {
        method: 'POST',
        body: JSON.stringify(values)
      });

      // Refetch data to get updated list
      fetchData(true);
      return appointment;
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Booking Failed',
        description: err.message || 'Failed to book appointment'
      });
      throw err;
    }
  }, [fetchData, toast]);

  const deleteAppointment = useCallback(async (appointmentId: string) => {
    try {
      await apiRequest(`/appointments/${appointmentId}`, {
        method: 'DELETE'
      });

      // Optimistic local state update
      setAppointments(prev => prev.filter(a => a.id !== appointmentId));
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: err.message || 'Failed to delete appointment'
      });
      throw err;
    }
  }, [toast]);

  const sendBookingLink = useCallback(async (phone: string, patientName?: string) => {
    try {
      await apiRequest('/appointments/send-link', {
        method: 'POST',
        body: JSON.stringify({ phone, patientName })
      });
      toast({
        title: "Link Sent Successfully",
        description: `A booking link has been sent to ${phone}.`
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to Send Link',
        description: err.message || 'Could not send the booking link.'
      });
      throw err;
    }
  }, [toast]);

  const getWalkInEstimate = useCallback(async (doctorId: string, date: string, force?: boolean) => {
    try {
      let url = `/appointments/walk-in-estimate?doctorId=${doctorId}&date=${date}`;
      if (force) url += `&force=true`;
      return await apiRequest<any>(url);
    } catch (err: any) {
      console.error('Error getting walk-in estimate:', err);
      return { unavailable: true, reason: err.message };
    }
  }, []);

  const getWalkInPreview = useCallback(async (doctorId: string, date: string) => {
    try {
      return await apiRequest<any>(`/appointments/walk-in-preview?doctorId=${doctorId}&date=${date}`);
    } catch (err: any) {
      console.error('Error getting walk-in preview:', err);
      throw err;
    }
  }, []);

  const createWalkIn = useCallback(async (values: any) => {
    try {
      const data = await apiRequest('/appointments/walk-in', {
        method: 'POST',
        body: JSON.stringify(values)
      });
      fetchData(true);
      return data;
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Walk-in Failed',
        description: err.message || 'Failed to create walk-in appointment'
      });
      throw err;
    }
  }, [fetchData, toast]);

  // ✅ FIX: Wrap the return value in useMemo so the object reference stays stable
  // between renders when the underlying data hasn't changed.
  // Without this, any component using this hook would receive a new object every render
  // and any downstream useEffect depending on these functions would fire endlessly.
  return useMemo(() => ({
    appointments,
    doctors,
    clinicDetails,
    loading,
    error,
    refresh: fetchData,
    updateStatus,
    bookAppointment,
    deleteAppointment,
    sendBookingLink,
    searchPatients,
    getPatientById,
    getWalkInEstimate,
    getWalkInPreview,
    createWalkIn
  }), [
    appointments,
    doctors,
    clinicDetails,
    loading,
    error,
    fetchData,
    updateStatus,
    bookAppointment,
    deleteAppointment,
    sendBookingLink,
    searchPatients,
    getPatientById,
    getWalkInEstimate,
    getWalkInPreview,
    createWalkIn
  ]);
}
