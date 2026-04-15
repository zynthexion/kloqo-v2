'use client';

import { useMemo } from 'react';
import { useAppointments } from '@/hooks/use-appointments';

export function useAppointmentSSE() {
  const {
    appointments,
    doctors,
    clinicDetails,
    loading,
    refresh,
    getWalkInEstimate,
    getWalkInPreview,
    searchPatients,
    getPatientProfile,
    getPatientById,
    bookAppointment,
    updateStatus,
    deleteAppointment,
    sendBookingLink,
  } = useAppointments();

  return useMemo(() => ({
    appointments,
    doctors,
    clinicDetails,
    loading,
    refresh,
    getWalkInEstimate,
    getWalkInPreview,
    searchPatients,
    getPatientProfile,
    getPatientById,
    bookAppointment,
    updateStatus,
    deleteAppointment,
    sendBookingLink,
  }), [
    appointments,
    doctors,
    clinicDetails,
    loading,
    refresh,
    getWalkInEstimate,
    getWalkInPreview,
    searchPatients,
    getPatientProfile,
    getPatientById,
    bookAppointment,
    updateStatus,
    deleteAppointment,
    sendBookingLink,
  ]);
}
