import { format, isAfter, addHours } from 'date-fns';
import { IAppointmentRepository, IDoctorRepository } from '../domain/repositories';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { getClinicNow } from '../domain/services/DateUtils';

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
    const todayStr = format(now, 'yyyy-MM-dd'); // Actual current date (1 AM)
    
    // We want to clean up "yesterday's" data
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
    const yesterdayDisplayStr = format(yesterday, 'd MMMM yyyy');

    const result: CleanupResult = {
      skippedToNoShowCount: 0,
      doctorsAutoCheckedOut: 0,
      errors: [],
    };

    try {
      // 1. Convert Skipped -> No-show for yesterday
      const appointments = await this.appointmentRepo.findByClinicAndDate(clinicId, yesterdayDisplayStr);
      const skippedAppointments = appointments.filter(a => a.status === 'Skipped');

      for (const appt of skippedAppointments) {
        try {
          await this.appointmentRepo.update(appt.id, {
            status: 'No-show',
            noShowAt: now,
            updatedAt: now,
            cancellationReason: 'Session closed: Converted from Skipped to No-show.'
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
