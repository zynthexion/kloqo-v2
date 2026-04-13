'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api-client';
import { sendAppointmentReminderNotification } from '@/lib/notification-service';
import { parseAppointmentDateTime } from '@/lib/utils';
import { differenceInHours } from 'date-fns';
import type { Appointment } from '@kloqo/shared';

// Store sent reminders to avoid duplicates
const sentReminders = new Set<string>();

const REMINDER_HOURS_BEFORE = 2; // 2 hours before appointment

export function useAppointmentReminders() {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user?.id) return;

    const checkAndSendReminders = async () => {
      // Prevent multiple simultaneous checks
      if (checkRef.current) return;
      checkRef.current = true;

      try {
        const now = new Date();

        // Use V2 API instead of direct Firestore query
        const data = await apiRequest(`/patients/me/appointments`);
        const appointments = (data?.appointments || data || []) as Appointment[];

        for (const appointment of appointments) {
          const reminderKey = `${appointment.id}_reminder`;

          // Skip if already sent
          if (sentReminders.has(reminderKey)) continue;

          try {
            const appointmentDateTime = parseAppointmentDateTime(appointment.date, appointment.time);

            // Calculate hours until appointment
            const hoursUntilAppointment = differenceInHours(appointmentDateTime, now);

            // Check if appointment is approximately 2 hours away (within a 10-minute window)
            if (hoursUntilAppointment >= 1 && hoursUntilAppointment <= REMINDER_HOURS_BEFORE) {
              const minutesUntilAppointment = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60);
              if (minutesUntilAppointment >= 110 && minutesUntilAppointment <= 130) {
                let tokenDistribution: 'classic' | 'advanced' | undefined;
                try {
                  if (appointment.clinicId) {
                    const clinicData = await apiRequest(`/clinics/${appointment.clinicId}`);
                    tokenDistribution = clinicData?.clinic?.tokenDistribution;
                  }
                } catch (error) {
                  console.error('Error fetching clinic data for reminder:', error);
                }

                // Send reminder notification
                await sendAppointmentReminderNotification({
                  userId: (user as any).id || (user as any).uid || '',
                  appointmentId: appointment.id,
                  doctorName: appointment.doctor || '',
                  time: appointment.time,
                  tokenNumber: appointment.tokenNumber,
                  tokenDistribution,
                  cancelledByBreak: appointment.cancelledByBreak,
                });

                // Mark as sent
                sentReminders.add(reminderKey);
                console.log(`Reminder sent for appointment ${appointment.id}`);
              }
            }
          } catch (error) {
            console.error(`Error processing reminder for appointment ${appointment.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Error checking appointment reminders:', error);
      } finally {
        checkRef.current = false;
      }
    };

    // Check immediately on mount
    checkAndSendReminders();

    // Check every 10 minutes
    const interval = setInterval(checkAndSendReminders, 10 * 60 * 1000);
    intervalRef.current = interval;

    return () => clearInterval(interval);
  }, [user]);

  // Clean up logic simplified for V2
  useEffect(() => {
    if (!user?.id) return;
    // Reminders are cleaned up when the component unmounts or user changes
  }, [user]);

  return null;
}

