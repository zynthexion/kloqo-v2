import { format, isAfter, addHours } from 'date-fns';
import { IAppointmentRepository, IDoctorRepository } from '../domain/repositories';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { getClinicNow, getClinicISODateString, subMinutes } from '../domain/services/DateUtils';

export interface CleanupResult {
  skippedToNoShowCount: number;
  doctorsAutoCheckedOut: number;
  errors: string[];
}

/**
 * EndSessionCleanupUseCase
 * 
 * A scheduled task (e.g., runs at 1:00 AM daily) to perform hygiene operations:
 * 1. Convert 'Skipped' appointments from the previous day to 'No-show'.
 * 2. Auto-checkout doctors who are still 'In' long after their sessions ended.
 */
export class EndSessionCleanupUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository
  ) {}

  async execute(clinicId: string): Promise<CleanupResult> {
    const now = getClinicNow();
    
    // CRITICAL FIX: Use getClinicISODateString to ensure we get the date in IST (Asia/Kolkata),
    // otherwise the UTC server time at 1:00 AM IST (19:30 UTC) will result in the previous day!
    const todayStr = getClinicISODateString(now); 
    
    // We want to clean up "yesterday's" data
    const yesterday = subMinutes(now, 24 * 60);
    const yesterdayStr = getClinicISODateString(yesterday);

    const result: CleanupResult = {
      skippedToNoShowCount: 0,
      doctorsAutoCheckedOut: 0,
      errors: [],
    };

    try {
      // 1. Convert Skipped, Pending, Confirmed -> No-show for yesterday
      const appointments = await this.appointmentRepo.findByClinicAndDate(clinicId, yesterdayStr);
      const unresolvedAppointments = appointments.filter(a => ['Skipped', 'Pending', 'Confirmed'].includes(a.status));

      for (const appt of unresolvedAppointments) {
        try {
          await this.appointmentRepo.update(appt.id, {
            status: 'No-show',
            noShowAt: now,
            updatedAt: now,
            cancellationReason: `Session closed: Converted from ${appt.status} to No-show.`
          });
          result.skippedToNoShowCount++;
        } catch (err: any) {
          result.errors.push(`Failed to update appointment ${appt.id}: ${err.message}`);
        }
      }

      // 2. Auto-Checkout Doctors
      const doctorsResult = await this.doctorRepo.findByClinicId(clinicId);
      const doctors = Array.isArray(doctorsResult) ? doctorsResult : doctorsResult.data;

      for (const doctor of doctors) {
        if (doctor.consultationStatus === 'In') {
          // Check session end time
          const slots = SlotCalculator.generateSlots(doctor, yesterday);
          if (slots.length > 0) {
            const lastSlot = slots[slots.length - 1];
            const sessionEndTime = addHours(lastSlot.time, 4); // 4-hour grace period after session end

            if (isAfter(now, sessionEndTime)) {
              await this.doctorRepo.update(doctor.id, {
                consultationStatus: 'Out',
                updatedAt: now
              });
              result.doctorsAutoCheckedOut++;
              console.log(`[Cleanup] Auto-checked out Doctor ${doctor.name} for clinic ${clinicId}`);
            }
          } else {
            // No slots configured for yesterday, but doctor is 'In' - auto checkout anyway
            await this.doctorRepo.update(doctor.id, {
                consultationStatus: 'Out',
                updatedAt: now
            });
            result.doctorsAutoCheckedOut++;
          }
        }
      }

    } catch (err: any) {
      result.errors.push(`Cleanup failed: ${err.message}`);
    }

    return result;
  }
}
