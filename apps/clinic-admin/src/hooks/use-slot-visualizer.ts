"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSSE } from "@/hooks/use-sse";
import { format, isAfter, isBefore, isSameDay, startOfDay, addMinutes } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import type { Appointment, Doctor } from '@kloqo/shared';
import { useToast } from "@/hooks/use-toast";
import { computeWalkInSchedule } from '@kloqo/shared-core';
import { 
  coerceDate, 
  computeFullDaySlots, 
  computeAppointmentsBySlot, 
  computeBucketCount, 
  computeSessionProgress 
} from "@/lib/slot-visualizer-utils";
import { parseTime } from "@/lib/utils";

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ACTIVE_STATUSES = new Set(["Pending", "Confirmed", "Completed"]);

export function useSlotVisualizer() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [clinicName, setClinicName] = useState<string | null>(null);
  const [walkInSpacing, setWalkInSpacing] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number>(0);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [c, d] = await Promise.all([apiRequest<any>('/clinic'), apiRequest<Doctor[]>('/clinic/doctors')]);
        if (cancelled) return;
        setClinicName(c?.name ?? null);
        const s = Number(c?.walkInTokenAllotment ?? 0);
        setWalkInSpacing(Number.isFinite(s) && s > 0 ? s : null);
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
    try {
      const formattedDate = format(selectedDate, "d MMMM yyyy");
      const docs = await apiRequest<Appointment[]>(`/clinic/appointments?doctorId=${selectedDoctorId}&date=${formattedDate}`);
      if (!isCancelledRef?.current) {
        setAppointments(docs.sort((a, b) => (Number(a.slotIndex) || 0) - (Number(b.slotIndex) || 0)));
      }
    } catch (e) {}
  }, [selectedDoctorId, selectedDate]);

  useEffect(() => {
    if (!selectedDoctorId) { setAppointments([]); return; }
    const c = { current: false };
    fetchAppointments(c);
    return () => { c.current = true; };
  }, [selectedDoctorId, selectedDate, fetchAppointments]);

  useSSE({
    clinicId: selectedDoctor?.clinicId || currentUser?.clinicId,
    onEvent: useCallback((e) => {
      if (['appointment_status_changed', 'token_called', 'queue_updated', 'walk_in_created'].includes(e.type)) fetchAppointments();
    }, [fetchAppointments])
  });

  const availableSessions = useMemo(() => {
    if (!selectedDoctor) return [];
    const day = daysOfWeek[selectedDate.getDay()];
    const availability = selectedDoctor.availabilitySlots?.find(s => s.day === day);
    return (availability?.timeSlots || []).map((s, i) => ({
      index: i, label: `Session ${i + 1} (${s.from} – ${s.to})`, from: s.from, to: s.to
    }));
  }, [selectedDoctor, selectedDate]);

  const fullDaySlots = useMemo(() => selectedDoctor ? computeFullDaySlots(selectedDoctor, selectedDate) : [], [selectedDoctor, selectedDate]);
  const appointmentsBySlot = useMemo(() => computeAppointmentsBySlot(appointments, fullDaySlots), [appointments, fullDaySlots]);
  const bucketCount = useMemo(() => computeBucketCount(appointments, fullDaySlots), [appointments, fullDaySlots]);

  const blockedSlots = useMemo(() => {
    const now = new Date();
    const buffer = addMinutes(now, 30);
    const blocked = new Set<number>();
    appointments.forEach(a => {
      if (typeof a.slotIndex !== "number") return;
      const slot = fullDaySlots.find(s => s.slotIndex === a.slotIndex);
      if (slot && (a.status === "No-show" || (a.status === "Cancelled" && !isAfter(slot.time, buffer)))) {
        if (!appointments.some(apt => apt.slotIndex === a.slotIndex && ACTIVE_STATUSES.has(apt.status ?? "") && apt.id !== a.id)) {
          blocked.add(a.slotIndex);
        }
      }
    });
    return blocked;
  }, [appointments, fullDaySlots]);

  const outsideAvailabilitySlots = useMemo(() => {
    const session = availableSessions[selectedSessionIndex];
    if (!session || !selectedDoctor) return [];
    const dur = selectedDoctor.averageConsultingTime || 15;
    const day = daysOfWeek[selectedDate.getDay()];
    const avail = selectedDoctor.availabilitySlots?.find(s => s.day === day);
    const result: any[] = [];
    appointments.forEach(a => {
      if (typeof a.slotIndex !== 'number' || fullDaySlots.some(s => s.slotIndex === a.slotIndex)) return;
      const sessionSlots = fullDaySlots.filter(s => s.sessionIndex === session.index);
      if (sessionSlots.length > 0 && a.slotIndex! > sessionSlots[sessionSlots.length - 1].slotIndex) {
        result.push({ slotIndex: a.slotIndex, appointment: a, time: addMinutes(sessionSlots[sessionSlots.length - 1].time, dur * (a.slotIndex! - sessionSlots[sessionSlots.length - 1].slotIndex)) });
      }
    });
    return result.sort((a, b) => a.slotIndex - b.slotIndex);
  }, [appointments, fullDaySlots, availableSessions, selectedSessionIndex, selectedDoctor, selectedDate]);

  const sessionSlots = useMemo(() => {
    const session = availableSessions[selectedSessionIndex];
    if (!session) return [];
    const inAvail = fullDaySlots.filter(s => s.sessionIndex === session.index).map(s => ({ ...s, appointment: appointmentsBySlot.get(s.slotIndex) }));
    const outAvail = outsideAvailabilitySlots.map(s => ({ slotIndex: s.slotIndex, time: s.time, appointment: s.appointment }));
    return [...inAvail, ...outAvail].sort((a, b) => a.slotIndex - b.slotIndex);
  }, [availableSessions, selectedSessionIndex, fullDaySlots, appointmentsBySlot, outsideAvailabilitySlots]);

  const scheduleReferenceTime = useMemo(() => {
    const now = new Date();
    return isSameDay(selectedDate, now) ? now : (isAfter(selectedDate, now) ? startOfDay(selectedDate) : now);
  }, [selectedDate]);

  const sessionSummary = useMemo(() => {
    const active = sessionSlots.filter(s => s.appointment && ACTIVE_STATUSES.has(s.appointment.status ?? "") && !isBefore(s.time, new Date()));
    const walkIn = active.filter(s => s.appointment.bookedVia === "Walk-in").length;
    const advanced = active.filter(s => s.appointment.bookedVia !== "Walk-in").length;
    const total = sessionSlots.filter(s => !isBefore(s.time, new Date())).length;
    return { total, booked: walkIn + advanced, available: Math.max(total - (walkIn + advanced) - bucketCount, 0), walkIn, advanced };
  }, [sessionSlots, bucketCount]);

  const capacityInfo = useMemo(() => {
    const total = sessionSummary.total;
    const res = total > 0 ? Math.ceil(total * 0.15) : 0;
    const maxA = Math.max(total - res, 0);
    return { total, reservedMinimum: res, maxAdvance: maxA, advancePercent: total > 0 ? (sessionSummary.advanced / total) * 100 : 0, walkInPercent: total > 0 ? (sessionSummary.walkIn / total) * 100 : 0, remainingAdvance: Math.max(maxA - sessionSummary.advanced, 0), limitReached: maxA > 0 && sessionSummary.advanced >= maxA };
  }, [sessionSummary]);

  const walkInSchedule = useMemo(() => {
    if (!selectedDoctor || fullDaySlots.length === 0) return { assignmentById: new Map(), placeholderAssignment: null };
    const candidates = appointments.filter(a => a.bookedVia === "Walk-in" && typeof a.slotIndex === "number" && ACTIVE_STATUSES.has(a.status ?? "")).map(a => ({ id: a.id, numericToken: Number(a.numericToken) || 0, createdAt: coerceDate(a.createdAt) ?? undefined, currentSlotIndex: a.slotIndex }));
    const placeholderId = "__next_walk_in__";
    const nextToken = (Math.max(...candidates.map(c => c.numericToken), fullDaySlots.length)) + 1;
    const schedule = computeWalkInSchedule({ slots: fullDaySlots.map(s => ({ index: s.slotIndex, time: s.time, sessionIndex: s.sessionIndex })), now: scheduleReferenceTime, walkInTokenAllotment: Math.floor(walkInSpacing || 0), advanceAppointments: appointments.filter(a => a.bookedVia !== "Walk-in" && typeof a.slotIndex === "number" && ACTIVE_STATUSES.has(a.status ?? "")).map(e => ({ id: e.id, slotIndex: e.slotIndex! })), walkInCandidates: [...candidates, { id: placeholderId, numericToken: nextToken, createdAt: new Date() }] });
    const map = new Map();
    schedule.assignments.forEach(a => map.set(a.id, { slotIndex: a.slotIndex ?? -1, sessionIndex: a.sessionIndex ?? -1, slotTime: a.slotTime }));
    return { assignmentById: map, placeholderAssignment: map.get(placeholderId) || null };
  }, [appointments, fullDaySlots, scheduleReferenceTime, selectedDoctor, walkInSpacing]);

  const cancelledAndNoShowSlots = useMemo(() => {
    const buffer = addMinutes(new Date(), 30);
    return appointments.filter(a => typeof a.slotIndex === "number" && (a.status === "No-show" || (a.status === "Cancelled" && !isAfter(fullDaySlots.find(s => s.slotIndex === a.slotIndex)?.time || new Date(), buffer))))
      .map(a => {
        const s = fullDaySlots.find(slot => slot.slotIndex === a.slotIndex);
        return s && !appointments.some(apt => apt.slotIndex === a.slotIndex && ACTIVE_STATUSES.has(apt.status ?? "") && apt.id !== a.id) ? { slotIndex: a.slotIndex, time: s.time, appointment: a, sessionIndex: s.sessionIndex } : null;
      }).filter((s): s is any => s !== null).sort((a, b) => a.slotIndex - b.slotIndex);
  }, [appointments, fullDaySlots]);

  const sessionProgress = useMemo(() => computeSessionProgress(sessionSlots, selectedDoctor), [selectedDoctor, sessionSlots]);

  return { loading, clinicName, walkInSpacing, selectedDate, setSelectedDate, selectedDoctorId, setSelectedDoctorId, selectedSessionIndex, setSelectedSessionIndex, doctors, appointments, selectedDoctor, availableSessions, fullDaySlots, appointmentsBySlot, bucketCount, blockedSlots, outsideAvailabilitySlots, sessionSlots, scheduleReferenceTime, sessionSummary, capacityInfo, walkInSchedule, nextWalkInPreview: walkInSchedule.placeholderAssignment ? { slotIndex: walkInSchedule.placeholderAssignment.slotIndex, time: walkInSchedule.placeholderAssignment.slotTime } : null, nextAdvancePreview: useMemo(() => {
    if (!selectedDoctor || fullDaySlots.length === 0) return null;
    const occupied = new Set(appointments.filter(a => typeof a.slotIndex === "number" && ACTIVE_STATUSES.has(a.status ?? "")).map(a => a.slotIndex!));
    const min = isSameDay(selectedDate, new Date()) ? addMinutes(scheduleReferenceTime, 30) : scheduleReferenceTime;
    for (const s of fullDaySlots) { if (!isBefore(s.time, scheduleReferenceTime) && !isBefore(s.time, min) && !occupied.has(s.slotIndex)) return { slotIndex: s.slotIndex, time: s.time }; }
    return null;
  }, [appointments, fullDaySlots, scheduleReferenceTime, selectedDate, selectedDoctor]), cancelledAndNoShowSlots, sessionProgress };
}
