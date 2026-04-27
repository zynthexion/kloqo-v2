import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isSameDay, addDays, subDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboard } from '@/hooks/useNurseDashboard';
import { Appointment } from '@kloqo/shared';
import { getClinicISODateString } from '@kloqo/shared-core';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useAppointmentManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const clinicId = user?.clinicId;

  const [selectedDoctor, setSelectedDoctor] = useState<string>(searchParams.get('doctor') || '');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [dateAppointments, setDateAppointments] = useState<Appointment[]>([]);
  const [dateLoading, setDateLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = 20;

  const { data, loading: dashLoading, updateAppointmentStatus } = useNurseDashboard(clinicId);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  // Auto-select first doctor and sync with URL
  useEffect(() => {
    if (data?.doctors?.length && !selectedDoctor) {
      const stored = localStorage.getItem('selectedDoctorId');
      const urlDocId = searchParams.get('doctor');
      const found = data.doctors.find(d => d.id === (urlDocId || stored));
      const initialId = found ? found.id : data.doctors[0].id;
      
      setSelectedDoctor(initialId);
      
      if (urlDocId !== initialId) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('doctor', initialId);
        router.replace(`?${params.toString()}`);
      }
    }
  }, [data?.doctors, selectedDoctor, searchParams, router]);
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch appointments for selected date
  useEffect(() => {
    if (!clinicId || !selectedDoctor) return;
    const isToday = isSameDay(selectedDate, new Date());
    
    // For today on real-time dash, we might want everything, 
    // but the user specifically asked for pagination on /appointments list.
    // So we apply it here.
    

    if (isToday && data?.appointments && !debouncedSearch) {
      setDateAppointments(data.appointments);
      setTotalCount(data.appointments.length);
      setHasMore(false);
      return;
    }

    const fetchData = async () => {
      setDateLoading(true);
      try {
        const dateStr = getClinicISODateString(selectedDate);
        const token = localStorage.getItem('token');
        const searchPart = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';

        const res = await fetch(`${API_URL}/appointments/dashboard?clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}&page=${page}&limit=${limit}${searchPart}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('[Appointments] Fetch Response:', res.status, res.statusText);
        if (res.ok) {
          const json = await res.json();
          console.log('[Appointments] Data Received:', {
            count: json.appointments?.length,
            total: json.totalCount,
            hasMore: json.hasMore
          });
          setDateAppointments(json.appointments ?? []);
          setTotalCount(json.totalCount ?? 0);
          setHasMore(json.hasMore ?? false);
        } else {
          const err = await res.text();
          console.error('[Appointments] Fetch Error Payload:', err);
        }
      } catch (e) {
        console.error('[Appointments] Fetch Error:', e);
      } finally {
        setDateLoading(false);
      }
    };
    fetchData();
  }, [clinicId, selectedDate, selectedDoctor, data?.appointments, page, debouncedSearch]);

  // Reset page when date or doctor changes
  useEffect(() => {
    setPage(1);
  }, [selectedDate, selectedDoctor]);

  const handleDoctorChange = useCallback((id: string) => {
    setSelectedDoctor(id);
    localStorage.setItem('selectedDoctorId', id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('doctor', id);
    router.replace(`?${params.toString()}`);
  }, [searchParams, router]);

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
