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
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 10;

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
    
    // For today on real-time dash, we might want everything, 
    // but the user specifically asked for pagination on /appointments list.
    // So we apply it here.
    

    if (isToday && data?.appointments) {
      setDateAppointments(data.appointments);
      return;
    }

    const fetchForDate = async () => {
      setDateLoading(true);
      try {
        const dateStr = getClinicISODateString(selectedDate);
        const token = localStorage.getItem('token');

        const res = await fetch(`${API_URL}/appointments/dashboard?clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}&page=${page}&limit=${limit}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setDateAppointments(json.appointments ?? []);
          setTotalCount(json.totalCount ?? 0);
          setHasMore(json.hasMore ?? false);
        }
      } catch (e) {
        console.error('[Appointments] Fetch Error:', e);
      } finally {
        setDateLoading(false);
      }
    };
    fetchForDate();
  }, [clinicId, selectedDate, selectedDoctor, data?.appointments, page]);

  // Reset page when date or doctor changes
  useEffect(() => {
    setPage(1);
  }, [selectedDate, selectedDoctor]);

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
    // Default to 7 days if not set, or use the doctor's specific setting
    const range = currentDoctor?.advanceBookingDays ?? 7;
    
    // Always include Today + Next N Days
    const standardDates = Array.from({ length: range + 1 }, (_, i) => addDays(today, i));
    
    // If the selected date is already in our standard range, just return it
    const isSelectedInStandard = standardDates.some(d => isSameDay(d, selectedDate));
    if (isSelectedInStandard) return standardDates;
    
    // If selected date is NOT in standard range (e.g. past or far future via calendar),
    // we prepend/append it to show it in the horizontal list, or just center it.
    // For simplicity, if it's a past date, we show a 3-day window around it.
    const customWindow = Array.from({ length: 7 }, (_, i) => addDays(subDays(selectedDate, 3), i));
    return customWindow;
  }, [selectedDate, currentDoctor?.advanceBookingDays]);

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
    updateAppointmentStatus,
    page,
    setPage,
    totalCount,
    hasMore,
    limit
  };
}
