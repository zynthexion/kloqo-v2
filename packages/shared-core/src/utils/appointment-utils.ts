import { 
  format, 
  getDay, 
  isAfter, 
  isBefore, 
  addMinutes, 
  startOfDay, 
  addDays 
} from 'date-fns';
import { 
  getClinicNow 
} from './date-utils';
import {
  isSlotBlockedByLeave,
  parseTime
} from './break-helpers';
import type { Appointment, Doctor } from '@kloqo/shared';

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const isDoctorAdvanceCapacityReachedOnDate = (
  doctor: Doctor,
  date: Date,
  appointments: Appointment[],
  options: { isEditing?: boolean; editingAppointment?: Appointment | null } = {}
): boolean => {
  const dayOfWeekName = daysOfWeek[getDay(date)];
  const availabilityForDay = doctor.availabilitySlots?.find((slot: any) => slot.day === dayOfWeekName);
  if (!availabilityForDay?.timeSlots?.length) return false;

  const slotDuration = doctor.averageConsultingTime || 15;
  const now = getClinicNow();
  const dateKeyLegacy = format(date, 'd MMMM yyyy');
  const dateKeyIso = format(date, 'yyyy-MM-dd');
  const dateKeys = [dateKeyLegacy, dateKeyIso];
  let maximumAdvanceTokens = 0;

  availabilityForDay.timeSlots.forEach((session: any, sessionIndex: number) => {
    let currentTime = parseTime(session.from, date);
    let sessionEnd = parseTime(session.to, date);
    
    // Extensions could be under legacy or ISO key
    const extensions = doctor.availabilityExtensions?.[dateKeyIso] || doctor.availabilityExtensions?.[dateKeyLegacy];

    if (extensions?.sessions && Array.isArray(extensions.sessions)) {
      const sessionExtension = extensions.sessions.find((s: any) => s.sessionIndex === sessionIndex);
      if (sessionExtension?.newEndTime) {
        sessionEnd = parseTime(sessionExtension.newEndTime, date);
      }
    }

    let futureSlotCount = 0;
    while (isBefore(currentTime, sessionEnd)) {
      const slotTime = new Date(currentTime);
      if (!isSlotBlockedByLeave(doctor, slotTime) && (isAfter(slotTime, now) || slotTime.getTime() >= now.getTime())) {
        futureSlotCount++;
      }
      currentTime = addMinutes(currentTime, slotDuration);
    }
    maximumAdvanceTokens += Math.max(futureSlotCount - Math.ceil(futureSlotCount * 0.15), 0);
  });

  if (maximumAdvanceTokens === 0) return true;

  let activeAdvanceCount = appointments.filter(apt => (
    apt.doctor === doctor.name &&
    apt.bookedVia !== 'Walk-in' &&
    dateKeys.includes(apt.date) &&
    (apt.status === 'Pending' || apt.status === 'Confirmed' || apt.status === 'Completed') &&
    !apt.cancelledByBreak
  )).length;

  const { isEditing, editingAppointment } = options;
  if (isEditing && dateKeys.includes(editingAppointment?.date || "") && editingAppointment?.doctor === doctor.name && editingAppointment?.bookedVia !== 'Walk-in') {
    activeAdvanceCount = Math.max(0, activeAdvanceCount - 1);
  }

  return activeAdvanceCount >= maximumAdvanceTokens;
};

export const getNextAvailableDate = (
  doctor?: Doctor | null,
  opts: { startDate?: Date; appointments?: Appointment[]; isEditing?: boolean; editingAppointment?: Appointment | null } = {}
): Date => {
  const { startDate = new Date(), appointments = [], isEditing = false, editingAppointment = null } = opts;
  if (!doctor?.availabilitySlots?.length) return startOfDay(startDate);

  for (let offset = 0; offset < 60; offset++) {
    const candidate = addDays(startOfDay(startDate), offset);
    const dayName = format(candidate, 'EEEE');
    const hasSlots = doctor.availabilitySlots.some((s: any) => s.day.toLowerCase() === dayName.toLowerCase() && s.timeSlots?.length);
    if (hasSlots && !isDoctorAdvanceCapacityReachedOnDate(doctor, candidate, appointments, { isEditing, editingAppointment })) {
      return candidate;
    }
  }
  return startOfDay(startDate);
};
