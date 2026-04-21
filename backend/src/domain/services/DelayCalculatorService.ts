import { differenceInMinutes, isAfter } from 'date-fns';
import { Appointment, Doctor } from '../../../../packages/shared/src/index';
import { SlotCalculator } from './SlotCalculator';

export class DelayCalculatorService {
  /**
   * Calculates the real-time delay for a doctor's current session.
   * Logic handles both "Late Start" (Out) and "Consultation Drag" (In).
   */
  static calculate(params: {
    doctor: Doctor;
    appointments: Appointment[];
    now: Date;
    sessionIndex: number;
  }): number {
    const { doctor, appointments, now, sessionIndex } = params;

    // SAFETY VALVE: If doctor is 'Out', calculate Late Start delay
    if (doctor.consultationStatus !== 'In') {
      const slots = SlotCalculator.generateSlots(doctor, now);
      const sessionSlots = slots.filter(s => s.sessionIndex === sessionIndex);
      if (sessionSlots.length > 0) {
        const sessionStart = sessionSlots[0].time;
        if (isAfter(now, sessionStart)) {
          // If session started but doctor is still 'Out', delay is (now - start)
          return Math.max(0, differenceInMinutes(now, sessionStart));
        }
      }
      return 0;
    }

    // PULSE CALCULATION: Doctor is 'In', check for Consultation Drag
    const inConsultation = appointments.find(a => 
      a.doctorId === doctor.id && 
      a.sessionIndex === sessionIndex &&
      a.status === 'InConsultation'
    );

    if (inConsultation) {
      const startedAt = inConsultation.updatedAt ? new Date(inConsultation.updatedAt) : null;
      if (startedAt) {
        const elapsed = differenceInMinutes(now, startedAt);
        const avgTime = doctor.averageConsultingTime || 15;
        // Drag is any time spent beyond the average consulting time
        return Math.max(0, elapsed - avgTime);
      }
    }

    // LATE START RECOVERY: If doctor is 'In' but no one has been seen yet,
    // the delay is still based on the session's start time gap.
    const hasCompletedAny = appointments.some(a => 
      a.doctorId === doctor.id && 
      a.sessionIndex === sessionIndex && 
      a.status === 'Completed'
    );

    if (!hasCompletedAny) {
      const slots = SlotCalculator.generateSlots(doctor, now);
      const sessionSlots = slots.filter(s => s.sessionIndex === sessionIndex);
      if (sessionSlots.length > 0) {
        const sessionStart = sessionSlots[0].time;
        if (isAfter(now, sessionStart)) {
          return Math.max(0, differenceInMinutes(now, sessionStart));
        }
      }
    }

    // No one is in consultation yet, and someone was already seen -> back on track.
    return 0;
  }
}
