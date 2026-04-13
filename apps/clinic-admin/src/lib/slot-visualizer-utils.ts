import { 
  addMinutes, 
  differenceInMinutes, 
  format, 
  getDay, 
  isAfter, 
  isBefore, 
  isSameDay, 
  startOfDay 
} from "date-fns";
import type { Appointment, Doctor } from "@kloqo/shared";
import { parseTime } from "@/lib/utils";
import { computeWalkInSchedule } from "@kloqo/shared-core";

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ACTIVE_STATUSES = new Set(["Pending", "Confirmed", "Completed"]);

export type SessionOption = {
  index: number;
  label: string;
  from: string;
  to: string;
};

export type SessionSlot = {
  slotIndex: number;
  time: Date;
  appointment?: Appointment;
};

export type DaySlot = {
  slotIndex: number;
  time: Date;
  sessionIndex: number;
};

export function coerceDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return new Date(parsed);
    const fromString = new Date(value);
    if (!Number.isNaN(fromString.valueOf())) return fromString;
  }
  if (typeof value === "object" && value !== null) {
    if ("toDate" in value && typeof (value as any).toDate === "function") {
      try { return (value as any).toDate(); } catch { return null; }
    }
    if ("seconds" in value && typeof (value as any).seconds === "number") {
      const seconds = (value as any).seconds;
      const nanos = Number((value as any).nanoseconds ?? 0);
      return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000));
    }
  }
  return null;
}

export function formatTimeDisplay(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  const date = coerceDate(value);
  return date ? format(date, "hh:mm a") : "—";
}

export function computeFullDaySlots(selectedDoctor: Doctor, selectedDate: Date) {
  const dayOfWeek = daysOfWeek[getDay(selectedDate)];
  const availabilityForDay = selectedDoctor.availabilitySlots?.find(slot => slot.day === dayOfWeek);
  if (!availabilityForDay?.timeSlots) return [];

  const slotDuration = selectedDoctor.averageConsultingTime || 15;
  const slots: any[] = [];

  availabilityForDay.timeSlots.forEach((session, sessionIndex) => {
    let currentTime = parseTime(session.from, selectedDate);
    let sessionEnd = parseTime(session.to, selectedDate);

    const dateKey = format(selectedDate, 'd MMMM yyyy');
    const extensionForDate = (selectedDoctor as any).availabilityExtensions?.[dateKey];

    if (extensionForDate) {
      const sessionExtension = extensionForDate.sessions?.find((s: any) => s.sessionIndex === sessionIndex);
      if (sessionExtension?.newEndTime && sessionExtension.totalExtendedBy > 0) {
        try {
          const extendedEndTime = parseTime(sessionExtension.newEndTime, selectedDate);
          if (isAfter(extendedEndTime, sessionEnd)) sessionEnd = extendedEndTime;
        } catch (e) {}
      }
    }

    let relativeIndex = 0;
    while (isBefore(currentTime, sessionEnd)) {
      slots.push({
        slotIndex: (sessionIndex * 1000) + relativeIndex,
        time: new Date(currentTime),
        sessionIndex,
      });
      currentTime = addMinutes(currentTime, slotDuration);
      relativeIndex += 1;
    }
  });

  return slots;
}

export function computeAppointmentsBySlot(appointments: Appointment[], fullDaySlots: any[]) {
  const map = new Map<number, Appointment>();
  const now = new Date();
  const bookingBuffer = addMinutes(now, 30);
  const slotTimeMap = new Map(fullDaySlots.map(s => [s.slotIndex, s.time]));

  const active: Appointment[] = [];
  const blocked: Appointment[] = [];
  const other: Appointment[] = [];

  appointments.forEach(appt => {
    if (typeof appt.slotIndex !== "number") return;
    const slotTime = slotTimeMap.get(appt.slotIndex);
    const isBlockedCancelled = appt.status === "Cancelled" && slotTime && !isAfter(slotTime, bookingBuffer);
    const isBlockedNoShow = appt.status === "No-show";

    if (appt.status === "Cancelled" && slotTime && isAfter(slotTime, bookingBuffer) && !isBlockedCancelled) return;

    if (ACTIVE_STATUSES.has(appt.status ?? "")) active.push(appt);
    else if (isBlockedCancelled || isBlockedNoShow) blocked.push(appt);
    else other.push(appt);
  });

  active.forEach(a => map.set(a.slotIndex!, a));
  blocked.forEach(a => {
    const existing = map.get(a.slotIndex!);
    if (existing && ACTIVE_STATUSES.has(existing.status ?? "")) return;
    if (!existing || (coerceDate(a.createdAt)?.getTime() ?? 0) >= (coerceDate(existing.createdAt)?.getTime() ?? 0)) {
      map.set(a.slotIndex!, a);
    }
  });
  other.forEach(a => {
    const existing = map.get(a.slotIndex!);
    if (existing && (ACTIVE_STATUSES.has(existing.status ?? "") || existing.status === "Cancelled" || existing.status === "No-show")) return;
    if (!existing || (coerceDate(a.createdAt)?.getTime() ?? 0) >= (coerceDate(existing.createdAt)?.getTime() ?? 0)) {
      map.set(a.slotIndex!, a);
    }
  });
  return map;
}

export function computeBucketCount(appointments: Appointment[], fullDaySlots: any[]) {
  const now = new Date();
  const buffer = addMinutes(now, 30);
  let count = 0;
  const activeWalkIns = appointments.filter(a => a.bookedVia === "Walk-in" && typeof a.slotIndex === "number" && ACTIVE_STATUSES.has(a.status ?? ""));
  const used = activeWalkIns.filter(a => a.slotIndex! >= fullDaySlots.length).length;
  const walkInTimes = activeWalkIns.map(a => fullDaySlots.find(s => s.slotIndex === a.slotIndex)?.time || coerceDate(a.time)).filter(Boolean);
  const activeSet = new Set(appointments.filter(a => typeof a.slotIndex === "number" && ACTIVE_STATUSES.has(a.status ?? "")).map(a => a.slotIndex!));

  appointments.forEach(a => {
    if ((a.status === "Cancelled" || a.status === "No-show") && typeof a.slotIndex === "number") {
      const slot = fullDaySlots.find(s => s.slotIndex === a.slotIndex);
      if (slot && !activeSet.has(a.slotIndex!) && activeWalkIns.length > 0) {
        if (!isAfter(slot.time, buffer)) {
          if (a.status === "Cancelled" && walkInTimes.some(t => isAfter(t!, slot.time))) count++;
          else if (a.status === "No-show") count++;
        } else if (a.status === "No-show") count++;
      }
    }
  });
  return Math.max(0, count - used);
}

export function computeSessionProgress(sessionSlots: any[], selectedDoctor: Doctor | null) {
  if (!selectedDoctor || sessionSlots.length === 0) return null;
  const dur = selectedDoctor.averageConsultingTime || 15;
  const start = sessionSlots[0].time;
  const end = sessionSlots[sessionSlots.length - 1].time;
  const totalMin = Math.max(differenceInMinutes(addMinutes(end, dur), start), 0);
  const completed = sessionSlots.filter(s => s.appointment?.status === "Completed").length;
  const expected = completed * dur;
  const actual = Math.min(Math.max(differenceInMinutes(new Date(), start), 0), totalMin);
  return {
    totalMinutes: totalMin, completedCount: completed, actualElapsed: actual,
    delayMinutes: actual - expected,
    progressValue: totalMin > 0 ? (expected / totalMin) * 100 : 0,
    actualProgressValue: totalMin > 0 ? (actual / totalMin) * 100 : 0,
    remainingCount: Math.max(sessionSlots.length - completed, 0)
  };
}
