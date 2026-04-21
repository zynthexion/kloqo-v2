"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSSE } from "@/hooks/use-sse";
import { format, isAfter, isBefore, isSameDay, startOfDay, addMinutes } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import type { Appointment, Doctor } from '@kloqo/shared';
import { useToast } from "@/hooks/use-toast";
import { 
  computeSessionProgress 
} from "@/lib/slot-visualizer-utils";
import { V2PreviewScheduler } from "@/lib/V2PreviewScheduler";

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ACTIVE_STATUSES = new Set(["Pending", "Confirmed", "Completed"]);

export function useSlotVisualizer() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [clinicName, setClinicName] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number>(0);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // --- V2 SIMULATION STATE ---
  const [isMockMode, setIsMockMode] = useState(false);
  const [mockAppointments, setMockAppointments] = useState<Partial<Appointment>[]>([]);
  const [strategyOverride, setStrategyOverride] = useState<'classic' | 'advanced' | undefined>(undefined);
  const [allotmentOverride, setAllotmentOverride] = useState<number | undefined>(undefined);
  const [ratioOverride, setRatioOverride] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [c, d] = await Promise.all([apiRequest<any>('/clinic'), apiRequest<Doctor[]>('/clinic/doctors')]);
        if (cancelled) return;
        setClinicName(c?.name ?? null);
        setDoctors(d);
        if (d.length > 0) setSelectedDoctorId(prev => prev || d[0].id);
      } catch (e) {
        toast({ variant: "destructive", title: "Unable to load data" });
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [currentUser, toast]);

  const selectedDoctor = useMemo(() => doctors.find(d => d.id === selectedDoctorId) ?? null, [doctors, selectedDoctorId]);

  const fetchAppointments = useCallback(async (isCancelledRef?: { current: boolean }) => {
    if (isMockMode || !selectedDoctorId) return;
    try {
      const formattedDate = format(selectedDate, "d MMMM yyyy");
      const docs = await apiRequest<Appointment[]>(`/clinic/appointments?doctorId=${selectedDoctorId}&date=${formattedDate}`);
      if (!isCancelledRef?.current) {
        setAppointments(docs.sort((a, b) => (Number(a.slotIndex) || 0) - (Number(b.slotIndex) || 0)));
      }
    } catch (e) {}
  }, [selectedDoctorId, selectedDate, isMockMode]);

  useEffect(() => {
    const c = { current: false };
    fetchAppointments(c);
    return () => { c.current = true; };
  }, [selectedDoctorId, selectedDate, fetchAppointments]);

  useSSE({
    clinicId: selectedDoctor?.clinicId || currentUser?.clinicId,
    onEvent: useCallback((e) => {
      if (!isMockMode && ['appointment_status_changed', 'token_called', 'queue_updated', 'walk_in_created'].includes(e.type)) {
        fetchAppointments();
      }
    }, [fetchAppointments, isMockMode])
  });

  const availableSessions = useMemo(() => {
    if (!selectedDoctor) return [];
    const day = daysOfWeek[selectedDate.getDay()];
    const availability = selectedDoctor.availabilitySlots?.find(s => s.day === day);
    return (availability?.timeSlots || []).map((s, i) => ({
      index: i, label: `Session ${i + 1} (${s.from} – ${s.to})`, from: s.from, to: s.to
    }));
  }, [selectedDoctor, selectedDate]);

  // --- V2 CORE CALCULATION ---
  const sessionSlots = useMemo(() => {
    if (!selectedDoctor) return [];
    
    return V2PreviewScheduler.generatePreview({
      doctor: selectedDoctor,
      date: selectedDate,
      sessionIndex: selectedSessionIndex,
      mockAppointments: isMockMode ? mockAppointments : appointments,
      strategyOverride,
      allotmentOverride,
      ratioOverride
    });
  }, [selectedDoctor, selectedDate, selectedSessionIndex, isMockMode, mockAppointments, appointments, strategyOverride, allotmentOverride, ratioOverride]);

  const sessionSummary = useMemo(() => {
    const active = sessionSlots.filter(s => s.appointment && ACTIVE_STATUSES.has(s.appointment.status ?? "") && !isBefore(s.time, new Date()));
    const walkIn = active.filter(s => s.appointment?.bookedVia === "Walk-in").length;
    const advanced = active.filter(s => s.appointment?.bookedVia !== "Walk-in").length;
    const total = sessionSlots.filter(s => !isBefore(s.time, new Date())).length;
    return { total, booked: walkIn + advanced, available: Math.max(total - (walkIn + advanced), 0), walkIn, advanced };
  }, [sessionSlots]);

  const capacityInfo = useMemo(() => {
    const total = sessionSummary.total;
    const resRatio = ratioOverride ?? (selectedDoctor?.walkInReserveRatio || 0.15);
    const res = total > 0 ? Math.ceil(total * resRatio) : 0;
    const maxA = Math.max(total - res, 0);
    return { 
      total, 
      reservedMinimum: res, 
      maxAdvance: maxA, 
      advancePercent: total > 0 ? (sessionSummary.advanced / total) * 100 : 0, 
      walkInPercent: total > 0 ? (sessionSummary.walkIn / total) * 100 : 0, 
      remainingAdvance: Math.max(maxA - sessionSummary.advanced, 0), 
      limitReached: maxA > 0 && sessionSummary.advanced >= maxA 
    };
  }, [sessionSummary, selectedDoctor, ratioOverride]);

  const sessionProgress = useMemo(() => computeSessionProgress(sessionSlots as any, selectedDoctor), [selectedDoctor, sessionSlots]);

  // --- MOCKING HELPERS ---
  const addMockAppointment = useCallback((type: 'A' | 'W' | 'P') => {
    setIsMockMode(true);
    setMockAppointments(prev => {
      // Find next free slot of the appropriate type if possible
      const freeSlot = sessionSlots.find(s => !s.appointment && (type === 'W' ? s.type === 'W' : s.type === 'A'))?.slotIndex;
      // Fallback to first free slot
      const targetSlot = freeSlot ?? sessionSlots.find(s => !s.appointment)?.slotIndex;
      
      if (targetSlot === undefined) {
        toast({ title: "Session Full", description: "No more slots available in this session." });
        return prev;
      }

      const newAppt: Partial<Appointment> = {
        id: `mock-${Date.now()}`,
        patientName: type === 'W' ? 'Walk-in Patient' : 'Upcoming Appointment',
        bookedVia: type === 'W' ? 'Walk-in' : 'Advanced Booking',
        status: 'Pending',
        slotIndex: targetSlot,
        tokenNumber: type === 'P' ? `PW-${prev.length + 1}` : (type === 'W' ? `W-${prev.length + 1}` : `${targetSlot + 1}`),
        createdAt: new Date()
      };
      return [...prev, newAppt];
    });
  }, [sessionSlots, toast]);

  const clearMockData = useCallback(() => {
    setMockAppointments([]);
    setIsMockMode(false);
    setStrategyOverride(undefined);
    setAllotmentOverride(undefined);
    setRatioOverride(undefined);
  }, []);

  return { 
    loading, 
    clinicName, 
    selectedDate, setSelectedDate, 
    selectedDoctorId, setSelectedDoctorId, 
    selectedSessionIndex, setSelectedSessionIndex, 
    doctors, 
    selectedDoctor, 
    availableSessions, 
    sessionSlots, 
    sessionSummary, 
    capacityInfo, 
    sessionProgress,
    // simulation
    isMockMode, setIsMockMode,
    strategyOverride, setStrategyOverride,
    allotmentOverride, setAllotmentOverride,
    ratioOverride, setRatioOverride,
    addMockAppointment,
    clearMockData,
    fetchAppointments
  };
}
