import { format } from 'date-fns';
import { Appointment } from '../../../packages/shared/src/index';
import { IAppointmentRepository, IClinicRepository, IDoctorRepository } from '../domain/repositories';
import { QueueBubblingService } from '../domain/services/QueueBubblingService';
import { getClinicNow } from '../domain/services/DateUtils';

export interface ProcessGracePeriodsResult {
  processed: number;
  skippedAppointmentIds: string[];
  errors: string[];
}

/**
 * ProcessGracePeriodsUseCase (The Sweep Engine)
 *
 * Runs on a schedule (every 5 minutes) triggered by a cron-protected route.
 * Automatically marks no-show patients as 'Skipped' when they have exceeded
 * their grace period, and triggers the QueueBubblingService to fill gaps.
 *
 * Grace Period Resolution Order:
 *   1. Doctor-level `gracePeriodMinutes` (most specific)
 *   2. Clinic-level `gracePeriodMinutes`
 *   3. System default: 15 minutes
 */
export class ProcessGracePeriodsUseCase {
  private readonly DEFAULT_GRACE_PERIOD_MINUTES = 15;

  constructor(
    private appointmentRepo: IAppointmentRepository,
    private clinicRepo: IClinicRepository,
    private doctorRepo: IDoctorRepository,
    private bubblingService: QueueBubblingService
  ) {}

  async execute(clinicId: string): Promise<ProcessGracePeriodsResult> {
    const now = getClinicNow();
    const today = format(now, 'd MMMM yyyy');
    const result: ProcessGracePeriodsResult = {
      processed: 0,
      skippedAppointmentIds: [],
      errors: [],
    };

    // Fetch all Confirmed appointments for today in this clinic
    const todaysAppointments = await this.appointmentRepo.findByClinicAndDate(clinicId, today);
    const confirmedAppointments = todaysAppointments.filter(a => a.status === 'Confirmed');

    if (confirmedAppointments.length === 0) return result;

    const clinic = await this.clinicRepo.findById(clinicId);
    if (!clinic) return result;

    for (const appointment of confirmedAppointments) {
      try {
        // Resolve the grace period: Doctor > Clinic > System Default
        const doctor = await this.doctorRepo.findById(appointment.doctorId);
        const gracePeriodMinutes =
          doctor?.gracePeriodMinutes ??
          clinic.gracePeriodMinutes ??
          this.DEFAULT_GRACE_PERIOD_MINUTES;

        // Parse the scheduled time for this appointment
        const [hours, minutes] = appointment.time.split(':').map(Number);
        const scheduledTime = new Date(now);
        scheduledTime.setHours(hours, minutes, 0, 0);

        // Check if the patient is past their grace period
        const gracePeriodDeadline = new Date(scheduledTime.getTime() + gracePeriodMinutes * 60 * 1000);
        if (now < gracePeriodDeadline) {
          // Still within grace period — do nothing
          continue;
        }

        // ── MARK AS SKIPPED & DECREMENT COUNTER (atomically) ──────────────────
        await this.appointmentRepo.runTransaction(async (txn) => {
          await this.appointmentRepo.update(
            appointment.id,
            {
              status: 'Skipped',
              skippedAt: now,
              updatedAt: now,
              cancelledBy: 'system',
              cancellationReason: `Auto-skipped: No arrival detected within ${gracePeriodMinutes}-minute grace period.`,
            },
            txn
          );

          if (appointment.sessionIndex !== undefined) {
            await this.appointmentRepo.updateBookedCount(
              appointment.clinicId,
              appointment.doctorId,
              appointment.date,
              appointment.sessionIndex,
              -1,
              txn
            );
          }
        });

        result.skippedAppointmentIds.push(appointment.id);
        result.processed++;

        // ── TRIGGER W-TOKEN BUBBLING ───────────────────────────────────────────
        // The vacated slot is now available. If any W-Tokens are waiting further
        // back in the queue, promote the earliest one into this slot.
        // If no W-Tokens exist, the slot stays vacant for the next walk-in.
        if (appointment.slotIndex !== undefined && appointment.sessionIndex !== undefined) {
          await this.bubblingService.reoptimize({
            vacatedSlotIndex: appointment.slotIndex,
            sessionIndex: appointment.sessionIndex,
            doctorId: appointment.doctorId,
            clinicId: appointment.clinicId,
            date: appointment.date,
          });
        }

        console.log(
          `[GracePeriodSweep] Auto-skipped appointment ${appointment.id} ` +
          `(Patient: ${appointment.patientName}, Doctor: ${appointment.doctorName}, ` +
          `${gracePeriodMinutes}m grace period exceeded)`
        );
      } catch (err: any) {
        console.error(`[GracePeriodSweep] Failed to process appointment ${appointment.id}:`, err.message);
        result.errors.push(`${appointment.id}: ${err.message}`);
      }
    }

    return result;
  }
}
