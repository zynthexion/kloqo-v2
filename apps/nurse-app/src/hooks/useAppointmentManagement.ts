import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isSameDay, addDays, subDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import { Appointment } from '@kloqo/shared';
import { getClinicISODateString } from '@kloqo/shared-core';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useAppointmentManagement() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const clinicId = user?.clinicId;

  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [dateAppointments, setDateAppointments] = useState<Appointment[]>([]);
  const [dateLoading, setDateLoading] = useState(false);

  const { data, loading: dashLoading, updateAppointmentStatus } = useNurseDashboard(clinicId);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // Auto-select first doctor
  useEffect(() => {
    if (data?.doctors?.length && !selectedDoctor) {
      const stored = localStorage.getItem('selectedDoctorId');
      const found = data.doctors.find(d => d.id === stored);
      setSelectedDoctor(found ? found.id : data.doctors[0].id);
    }
  }, [data?.doctors, selectedDoctor]);

  // Fetch appointments for selected date
  useEffect(() => {
    if (!clinicId || !selectedDoctor) return;
    const isToday = isSameDay(selectedDate, new Date());
    

    if (isToday && data?.appointments) {
      setDateAppointments(data.appointments);
      return;
    }

    const fetchForDate = async () => {
      setDateLoading(true);
      try {
        const dateStr = getClinicISODateString(selectedDate);
        const token = localStorage.getItem('token');

        const res = await fetch(`${API_URL}/appointments/dashboard?clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setDateAppointments(json.appointments ?? []);
        }
      } catch (e) {
        console.error('[Appointments] Fetch Error:', e);
      } finally {
        setDateLoading(false);
      }
    };
    fetchForDate();
  }, [clinicId, selectedDate, selectedDoctor, data?.appointments]);

  const handleDoctorChange = useCallback((id: string) => {
    setSelectedDoctor(id);
    localStorage.setItem('selectedDoctorId', id);
  }, []);

  const currentDoctor = useMemo(() => 
    data?.doctors.find(d => d.id === selectedDoctor),
    [data?.doctors, selectedDoctor]
  );

  const filteredAppointments = useMemo(() => {
    return dateAppointments
      .filter(a => !selectedDoctor || a.doctorId === selectedDoctor)
      .filter(a =>
        !searchTerm.trim() ||
        a.patientName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [dateAppointments, selectedDoctor, searchTerm]);

  const dates = useMemo(() => {
    const today = new Date();
    const baseStart = subDays(today, 90);
    const baseEnd = addDays(today, 275);
    
    // If selected date is within our standard 1-year window, keep the range stable
    if (selectedDate >= baseStart && selectedDate <= baseEnd) {
      return Array.from({ length: 365 }, (_, i) => addDays(baseStart, i));
    }
    
    // If we jump further via calendar, center a new 1-year window around that date
    const jumpStart = subDays(selectedDate, 182);
    return Array.from({ length: 365 }, (_, i) => addDays(jumpStart, i));
  }, [selectedDate]);

  return {
    user,
    authLoading,
    dashLoading,
    data,
    selectedDoctor,
    selectedDate,
    setSelectedDate,
    searchTerm,
    setSearchTerm,
    dateLoading,
    handleDoctorChange,
    currentDoctor,
    filteredAppointments,
    dates,
    updateAppointmentStatus
  };
}
