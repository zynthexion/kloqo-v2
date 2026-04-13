'use client';

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
    getPatientById,
    bookAppointment,
    updateStatus,
    deleteAppointment,
    sendBookingLink,
  } = useAppointments();

  return {
    appointments,
    doctors,
    clinicDetails,
    loading,
    refresh,
    getWalkInEstimate,
    getWalkInPreview,
    searchPatients,
    getPatientById,
    bookAppointment,
    updateStatus,
    deleteAppointment,
    sendBookingLink,
  };
}
