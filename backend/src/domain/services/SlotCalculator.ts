import { addMinutes, isAfter, isBefore, subMinutes, format } from 'date-fns';
import { Appointment, Doctor, Clinic } from '../../../../packages/shared/src/index';
import { parseClinicTime, getClinicISODateString, getClinicDateString } from './DateUtils';
import { computeWalkInSchedule, SchedulerSlot, SchedulerAdvance, SchedulerWalkInCandidate } from './SlotScheduler';

export interface DailySlot {
  index: number;
  time: Date;
  sessionIndex: number;
}

export class SlotCalculator {
  static generateSlots(doctor: Doctor, date: Date): DailySlot[] {
    // 1. Check for specific date override first (Rule: Specific overrides beat weekly recurring)
    const dateStrIso = getClinicISODateString(date);
    const override = doctor.dateOverrides?.[dateStrIso];

    if (override) {
      if (override.isOff) return []; // Explicitly off this day
      
      const slotDuration = doctor.averageConsultingTime || 15;
      const slots: DailySlot[] = [];
      let slotIndex = 0;

      if (override.slots && override.slots.length > 0) {
        override.slots.forEach((session, sessionIndex) => {
          let currentTime = parseClinicTime(session.from, date);
          let endTime = parseClinicTime(session.to, date);

          while (isBefore(currentTime, endTime)) {
            slots.push({ index: slotIndex, time: new Date(currentTime), sessionIndex });
            currentTime = addMinutes(currentTime, slotDuration);
            slotIndex++;
          }
        });
        return slots;
      }
    }

    // 2. Weekly Recurring Availability lookup
    // Principal SRE Catch: Day names must match case-insensitively.
    // Also: Day of week must be calculated relative to IST offset if server is in UTC.
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Convert current Date to IST and extract the day correctly (Rule 8: IST Enforced)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
    });
    const dayName = formatter.format(date); // e.g., "Monday"

    const availability = doctor.availabilitySlots.find(s => 
      s.day.toLowerCase() === dayName.toLowerCase()
    );
    if (!availability || availability.timeSlots.length === 0) return [];

    const slotDuration = doctor.averageConsultingTime || 15;
    const slots: DailySlot[] = [];
    let slotIndex = 0;

    // Availability extensions
    // Availability extensions: check both legacy and ISO keys
    const dateStrLegacy = getClinicDateString(date);
    const dateStrIsoExt = getClinicISODateString(date);
    const legacyExtension = doctor.availabilityExtensions?.[dateStrLegacy];
    const isoExtension = doctor.availabilityExtensions?.[dateStrIsoExt];
    
    // ISO takes precedence if both exist, but we merge logic if needed (here we just need the sessions)
    const extension = isoExtension || legacyExtension;

    availability.timeSlots.forEach((session, sessionIndex) => {
      let currentTime = parseClinicTime(session.from, date);
      let endTime = parseClinicTime(session.to, date);

      const sessionExtension = (extension as any)?.sessions?.find((s: any) => s.sessionIndex === sessionIndex);
      if (sessionExtension?.newEndTime) {
        const extEnd = parseClinicTime(sessionExtension.newEndTime, date);
        if (isAfter(extEnd, endTime)) endTime = extEnd;
      }

      while (isBefore(currentTime, endTime)) {
        slots.push({ index: slotIndex, time: new Date(currentTime), sessionIndex });
        currentTime = addMinutes(currentTime, slotDuration);
        slotIndex++;
      }
    });

    return slots;
  }

  static findActiveSessionIndex(doctor: Doctor, slots: DailySlot[], now: Date, tokenDistribution: string, appointments: Appointment[] = []): number | null {
    if (slots.length === 0) return 0;
    const isClassic = tokenDistribution === 'classic';

    const sessionMap = new Map<number, { start: Date; end: Date }>();
    slots.forEach(s => {
      const range = sessionMap.get(s.sessionIndex) || { start: s.time, end: s.time };
      if (isBefore(s.time, range.start)) range.start = s.time;
      if (isAfter(s.time, range.end)) range.end = s.time;
      sessionMap.set(s.sessionIndex, range);
    });

    const sessions = Array.from(sessionMap.entries()).sort((a, b) => a[0] - b[0]);

    for (let i = 0; i < sessions.length; i++) {
        const [idx, range] = sessions[i];
        
        // --- STICKY SESSION LOGIC ---
        // A session remains "Active" even past its nominal end time if:
        // 1. The doctor is explicitly marked as "In" consultation status.
        // 2. AND there are still pending/confirmed appointments for this session that aren't completed.
        const isPastEndTime = isAfter(now, range.end);
        const hasPendingWork = appointments.some(a => 
          a.sessionIndex === idx && 
          (a.status === 'Pending' || a.status === 'Confirmed') && 
          !a.isDeleted
        );
        const isDoctorIn = doctor.consultationStatus === 'In';
        const isStickyOvertime = isPastEndTime && isDoctorIn && hasPendingWork;

        if (isClassic) {
            // Simple logic: pick first session that hasn't ended OR is in sticky overtime
            if (!isPastEndTime || isStickyOvertime) return idx;
        } else {
            // Advanced: 30m window OR sticky overtime
            const isWithinPreStartWindow = !isBefore(now, subMinutes(range.start, 30));
            if ((!isPastEndTime && isWithinPreStartWindow) || isStickyOvertime) {
                return idx;
            }
        }
    }
    return null;
  }

  static calculatePerSessionReservedSlots(
    slots: DailySlot[],
    now: Date
  ): Set<number> {
    const reservedSlots = new Set<number>();
    const slotsBySession = new Map<number, DailySlot[]>();

    slots.forEach(slot => {
      const sessionSlots = slotsBySession.get(slot.sessionIndex) || [];
      sessionSlots.push(slot);
      slotsBySession.set(slot.sessionIndex, sessionSlots);
    });

    slotsBySession.forEach((sessionSlots) => {
      sessionSlots.sort((a, b) => a.index - b.index);
      const futureSlots = sessionSlots.filter(slot =>
        (slot.time.getTime() >= now.getTime())
      );

      if (futureSlots.length === 0) return;

      const futureSlotCount = futureSlots.length;
      const minimumWalkInReserve = Math.ceil(futureSlotCount * 0.15);
      const reservedWSlotsStart = futureSlotCount - minimumWalkInReserve;

      for (let i = reservedWSlotsStart; i < futureSlotCount; i++) {
        reservedSlots.add(futureSlots[i].index);
      }
    });

    return reservedSlots;
  }
}
