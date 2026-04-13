import { format, parse, addMinutes, isAfter, differenceInMinutes, parseISO } from 'date-fns';
import { Appointment } from '@kloqo/shared';
import { parseTime } from '../utils/break-helpers';
import { compareAppointments, compareAppointmentsClassic } from './appointment-service';

// Helper function to easily parse Appointment string times into Date objects
export function parseAppointmentTime(apt: Appointment): Date | null {
  try {
      if (!apt.date || !apt.time) return null;
      // We do not have parseTime in shared yet, so build a pure JS date string parser
      const datePart = apt.date; // e.g., "15 March 2026"
      const timePart = apt.time; // e.g., "09:30 AM"
      const d = parse(`${datePart} ${timePart}`, 'd MMMM yyyy hh:mm a', new Date());
      return isNaN(d.getTime()) ? null : d;
  } catch {
      return null;
  }
}

// Simulate where a skipped appointment would be placed if it rejoined now
export function simulateSkippedRejoinTime(skippedAppointment: Appointment, now: Date = new Date()): Date | null {
  try {
      if (!skippedAppointment.time || !skippedAppointment.noShowTime) return null;

      const scheduledTime = parseAppointmentTime(skippedAppointment);
      if (!scheduledTime) return null;

      let noShowDate: Date;
      if ((skippedAppointment.noShowTime as any)?.toDate) {
          noShowDate = (skippedAppointment.noShowTime as any).toDate();
      } else {
          noShowDate = new Date(skippedAppointment.noShowTime as any);
      }

      if (isNaN(noShowDate.getTime())) return null;

      if (isAfter(now, scheduledTime)) {
          // Current time past the 'time' -> noShowTime + 15 minutes
          return addMinutes(noShowDate, 15);
      } else {
          // Current time didn't pass 'time' -> bare noShowTime
          return noShowDate;
      }
  } catch (error) {
      console.error('Error simulating skipped rejoin time:', error);
      return null;
  }
}

// Centralized generic queue builder for predicted UI representation
export function buildSimulatedQueue(
  allAppointmentsForDoctorAndDate: Appointment[],
  tokenDistribution: 'classic' | 'advanced' | string = 'classic',
  now: Date = new Date(),
  targetAppointmentId?: string
): Appointment[] {
  // Get Pending and Confirmed appointments (these are at their current positions)
  const pendingAndConfirmed = allAppointmentsForDoctorAndDate.filter(apt =>
      apt.status === 'Pending' || apt.status === 'Confirmed'
  );

  // Identify patient's natural position if passing targetId
  let isTopPosition = false;
  let yourAppointmentTime: Date | null = null;
  
  if (targetAppointmentId) {
      const yourApt = allAppointmentsForDoctorAndDate.find(a => a.id === targetAppointmentId);
      if (yourApt) {
          yourAppointmentTime = parseAppointmentTime(yourApt);
          const yourNaturalIndex = pendingAndConfirmed.findIndex(a => a.id === targetAppointmentId);
          isTopPosition = yourNaturalIndex !== -1 && yourNaturalIndex <= 1; // 1st or 2nd
      }
  }

  // Get Skipped appointments (simulate where they will be placed if rejoined now)
  const skippedAppointments = allAppointmentsForDoctorAndDate.filter(apt =>
      apt.status === 'Skipped' && apt.id !== targetAppointmentId
  );

  const simulatedSkippedAppointments: Array<{ appointment: Appointment; simulatedTime: Date }> = [];
  for (const skipped of skippedAppointments) {
      const simulatedTime = simulateSkippedRejoinTime(skipped, now);
      if (simulatedTime) {
          simulatedSkippedAppointments.push({ 
              appointment: { ...skipped, time: format(simulatedTime, 'hh:mm a') }, 
              simulatedTime 
          });
      }
  }

  // Build the complete queue: pending/confirmed + simulated skipped
  const queue: Array<{ appointment: Appointment; queueTime: Date }> = [];

  for (const apt of pendingAndConfirmed) {
      if (isTopPosition && apt.status === 'Pending' && apt.id !== targetAppointmentId) {
          continue; // stability constraint
      }
      const aptTime = parseAppointmentTime(apt) || new Date(0);
      queue.push({ appointment: apt, queueTime: aptTime });
  }

  if (!isTopPosition && yourAppointmentTime) {
      for (const { appointment, simulatedTime } of simulatedSkippedAppointments) {
          if (simulatedTime.getTime() < yourAppointmentTime.getTime()) {
              queue.push({ appointment, queueTime: simulatedTime });
          }
      }
  } else if (!targetAppointmentId) {
     // If building entire queue generally (e.g. nurse/admin end or total count)
     for (const { appointment, simulatedTime } of simulatedSkippedAppointments) {
        queue.push({ appointment, queueTime: simulatedTime });
     }
  }

  queue.sort((a, b) => (tokenDistribution === 'classic' 
      ? compareAppointmentsClassic(a.appointment, b.appointment) 
      : compareAppointments(a.appointment, b.appointment)
  ));

  return queue.map(item => item.appointment);
}

export function calculateDelayForAppointments(
    appointments: Appointment[],
    currentTokenAppointment: Appointment | null | undefined,
    avgConsultingTime: number,
    currentTime: Date
): Map<string, number> {
    const delayMap = new Map<string, number>();

    if (!currentTokenAppointment || appointments.length === 0) {
        return delayMap;
    }

    const currentIndex = appointments.findIndex(apt => apt.id === currentTokenAppointment.id);
    if (currentIndex === -1) return delayMap;

    try {
        const scheduledTime = parseAppointmentTime(currentTokenAppointment);
        if (!scheduledTime) return delayMap;
        
        const currentDelay = Math.max(0, differenceInMinutes(currentTime, scheduledTime));

        delayMap.set(currentTokenAppointment.id, 0);
        let accumulatedDelay = currentDelay;

        for (let i = currentIndex + 1; i < appointments.length; i++) {
            const appointment = appointments[i];
            const prevAppointment = appointments[i - 1];

            const currentScheduledTime = parseAppointmentTime(appointment);
            const prevScheduledTime = parseAppointmentTime(prevAppointment);
            if (!currentScheduledTime || !prevScheduledTime) continue;

            const gapBetweenSlots = differenceInMinutes(currentScheduledTime, prevScheduledTime);

            if (gapBetweenSlots > avgConsultingTime) {
                const absorbedDelay = gapBetweenSlots - avgConsultingTime;
                accumulatedDelay = Math.max(0, accumulatedDelay - absorbedDelay);
            }

            delayMap.set(appointment.id, Math.round(accumulatedDelay));
        }
    } catch (error) {
        console.error('Error calculating delays:', error);
    }

    return delayMap;
}
