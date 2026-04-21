import { Doctor } from '../../../../packages/shared/src/index';
import { parseISO, isSameMinute, isBefore, isAfter, addMinutes } from 'date-fns';
import { getClinicDateString } from './DateUtils';

export class AvailabilityValidator {
  /**
   * Checks if a specific slot time is blocked by a scheduled break or leave
   */
  static isSlotBlocked(doctor: Doctor, slotTime: Date): boolean {
    if (!doctor || !doctor.breakPeriods) return false;

    const dateStrLegacy = getClinicDateString(slotTime);
    const dateStrIso = slotTime.toISOString().split('T')[0];
    
    const legacyBreaks = doctor.breakPeriods[dateStrLegacy] || [];
    const isoBreaks = doctor.breakPeriods[dateStrIso] || [];
    const breaks = [...(Array.isArray(legacyBreaks) ? legacyBreaks : []), ...(Array.isArray(isoBreaks) ? isoBreaks : [])];

    if (breaks.length === 0) return false;

    return breaks.some(breakPeriod => {
      try {
        // Method 1: Explicit slots list
        if (breakPeriod.slots && Array.isArray(breakPeriod.slots)) {
          const isExplicitlyListed = breakPeriod.slots.some((s: string) => {
            const sDate = parseISO(s);
            return isSameMinute(sDate, slotTime);
          });
          if (isExplicitlyListed) return true;
        }

        // Method 2: Range check
        const breakStart = parseISO(breakPeriod.startTime);
        const breakEnd = parseISO(breakPeriod.endTime);

        const slotDuration = doctor.averageConsultingTime || 15;
        const slotEnd = addMinutes(slotTime, slotDuration);

        // Check overlap: slot starts before break ends AND slot ends after break starts
        const isBlocked = isBefore(slotTime, breakEnd) && isAfter(slotEnd, breakStart);
        return isBlocked;
      } catch (error) {
        return false;
      }
    });
  }
}
