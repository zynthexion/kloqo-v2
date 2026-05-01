"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, isSameDay, isPast, endOfDay, addDays, subDays } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useNurseDashboard } from "@/hooks/useNurseDashboard";
import { getClinicNow } from "@kloqo/shared-core";
import type { Appointment, Doctor } from "@kloqo/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function useDaySnapshot() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState(getClinicNow());
  const [selectedDoctor, setSelectedDoctor] = useState<string>(searchParams.get("doctor") || "");
  const [activeSession, setActiveSession] = useState<string>("all");
  const [dateAppointments, setDateAppointments] = useState<Appointment[]>([]);
  const [dateLoading, setDateLoading] = useState(false);

  const clinicId = user?.clinicId;
  const { data, loading: dashLoading } = useNurseDashboard(clinicId);

  // Auto-select first doctor and sync with URL
  useEffect(() => {
    if (data?.doctors?.length && !selectedDoctor) {
      const stored = localStorage.getItem("selectedDoctorId");
      const urlDocId = searchParams.get("doctor");
      const found = data.doctors.find(d => d.id === (urlDocId || stored));
      const initialId = found ? found.id : data.doctors[0].id;
      
      setSelectedDoctor(initialId);
      
      if (urlDocId !== initialId) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("doctor", initialId);
        router.replace(`?${params.toString()}`);
      }
    }
  }, [data?.doctors, selectedDoctor, searchParams, router]);

  const handleDoctorChange = useCallback((id: string) => {
    setSelectedDoctor(id);
    localStorage.setItem("selectedDoctorId", id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("doctor", id);
    router.replace(`?${params.toString()}`);
  }, [router, searchParams]);

  // Fetch appointments for selected date
  useEffect(() => {
    if (!clinicId || !selectedDoctor) return;
    const isToday = isSameDay(selectedDate, getClinicNow());

    if (isToday && data?.appointments) {
      setDateAppointments(data.appointments);
      return;
    }

    const fetchForDate = async () => {
      setDateLoading(true);
      try {
        const dateStr = format(selectedDate, "d MMMM yyyy");
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/appointments/dashboard?clinicId=${clinicId}&date=${encodeURIComponent(dateStr)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setDateAppointments(json.appointments ?? []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setDateLoading(false);
      }
    };
    fetchForDate();
  }, [clinicId, selectedDate, selectedDoctor, data?.appointments]);

  const currentDoctor = useMemo(() => 
    data?.doctors.find(d => d.id === selectedDoctor),
    [data?.doctors, selectedDoctor]
  );

  const sessions = useMemo(() => {
    if (!currentDoctor) return [];
    const dayName = format(selectedDate, "EEEE");
    const avail = (currentDoctor as any).availabilitySlots?.find((s: any) => s.day === dayName);
    return avail?.timeSlots || [];
  }, [currentDoctor, selectedDate]);

  const filteredAppointments = useMemo(() => {
    const doctorName = currentDoctor?.name;
    let appts = dateAppointments.filter(a => !doctorName || a.doctorName === doctorName);
    if (activeSession !== "all") {
      const idx = parseInt(activeSession);
      appts = appts.filter(a => (a as any).sessionIndex === idx);
    }
    return appts;
  }, [dateAppointments, currentDoctor, activeSession]);

  const isPastDate = useMemo(() => 
    isPast(endOfDay(selectedDate)) && !isSameDay(selectedDate, getClinicNow()),
    [selectedDate]
  );

  const stats = useMemo(() => ({
    total: filteredAppointments.length,
    pending: filteredAppointments.filter(a => a.status === "Pending").length,
    confirmed: filteredAppointments.filter(a => a.status === "Confirmed").length,
    completed: filteredAppointments.filter(a => a.status === "Completed").length,
    cancelled: filteredAppointments.filter(a => a.status === "Cancelled").length,
    noshow: filteredAppointments.filter(a => a.status === "No-show").length,
    skipped: filteredAppointments.filter(a => a.status === "Skipped").length,
  }), [filteredAppointments]);

  const breaks = useMemo(() => {
    if (!(currentDoctor as any)?.breakPeriods) return [];
    const dateKey = format(selectedDate, "d MMMM yyyy");
    return (currentDoctor as any).breakPeriods[dateKey] || [];
  }, [currentDoctor, selectedDate]);

  // Generate 7 before + 14 after today
  const dates = useMemo(() => {
    const today = getClinicNow();
    // Default to 7 days if not set, or use the doctor's specific setting
    const range = (currentDoctor as any)?.advanceBookingDays ?? 7;
    
    // Always include Today + Next N Days
    const standardDates = Array.from({ length: range + 1 }, (_, i) => addDays(today, i));
    
    // If the selected date is already in our standard range, just return it
    const isSelectedInStandard = standardDates.some(d => isSameDay(d, selectedDate));
    if (isSelectedInStandard) return standardDates;
    
    // If selected date is NOT in standard range (e.g. past or far future via calendar),
    // we show a 7-day window around it.
    const customWindow = Array.from({ length: 7 }, (_, i) => addDays(subDays(selectedDate, 3), i));
    return customWindow;
  }, [selectedDate, currentDoctor?.advanceBookingDays]);

  return {
    user,
    authLoading,
    selectedDate,
    setSelectedDate,
    selectedDoctor,
    setSelectedDoctor,
    activeSession,
    setActiveSession,
    dateAppointments,
    dateLoading,
    dashLoading,
    data,
    currentDoctor,
    sessions,
    filteredAppointments,
    isPastDate,
    stats,
    breaks,
    dates,
    handleDoctorChange
  };
}
