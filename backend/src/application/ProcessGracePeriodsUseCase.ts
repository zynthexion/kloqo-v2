import { format, isAfter } from 'date-fns';
import { Appointment, Doctor } from '../../../packages/shared/src/index';
import { IAppointmentRepository, IClinicRepository, IDoctorRepository } from '../domain/repositories';
import { QueueBubblingService } from '../domain/services/QueueBubblingService';
import { getClinicNow, getClinicISODateString } from '../domain/services/DateUtils';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { DelayCalculatorService } from '../domain/services/DelayCalculatorService';

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
    const today = getClinicISODateString(now);
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

    // Cache doctors to avoid redundant DB reads
    const doctorCache = new Map<string, Doctor>();

    // 1. Identify all eligible appointments across all doctors in this clinic
    const toSkip: Appointment[] = [];
    for (const appointment of confirmedAppointments) {
      // EXEMPTION: Priority patients (PW tokens) are never auto-skipped
      if (appointment.tokenNumber?.startsWith('PW-')) {
        continue;
      }

      let doctor = doctorCache.get(appointment.doctorId);
      if (!doctor) {
        doctor = await this.doctorRepo.findById(appointment.doctorId) as Doctor;
        if (doctor) doctorCache.set(appointment.doctorId, doctor);
      }

      if (!doctor) continue;

      // SAFETY VALVE: If doctor is 'Out', no patient is ever auto-skipped
      if (doctor.consultationStatus !== 'In') {
        continue;
      }

      // PULSE CALCULATION: Determine if the doctor is running behind
      const liveDelayMinutes = DelayCalculatorService.calculate({
        doctor,
        appointments: todaysAppointments,
        now,
        sessionIndex: appointment.sessionIndex || 0
      });

      const gracePeriodMinutes = doctor.gracePeriodMinutes ?? clinic.gracePeriodMinutes ?? this.DEFAULT_GRACE_PERIOD_MINUTES;

      const [hours, minutes] = appointment.time.split(':').map(Number);
      const scheduledTime = new Date(now);
      scheduledTime.setHours(hours, minutes, 0, 0);

      // Effective Deadline = ScheduledTime + LiveDelay + GracePeriod
      const effectiveDeadline = new Date(scheduledTime.getTime() + (liveDelayMinutes + gracePeriodMinutes) * 60 * 1000);
      
      if (now >= effectiveDeadline) {
        toSkip.push(appointment);
      }
    }

    if (toSkip.length === 0) return result;

    // 2. Group by Doctor/Session so we can trigger Vacuum once per group
    const groups = new Map<string, Appointment[]>();
    for (const appt of toSkip) {
      const key = `${appt.doctorId}_${appt.sessionIndex}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(appt);
    }

    // 3. Process Skips in Atomic Batches per Doctor/Session
    for (const [key, appts] of groups.entries()) {
      const first = appts[0];
      try {
        await this.appointmentRepo.runTransaction(async (txn) => {
          for (const appointment of appts) {
            await this.appointmentRepo.update(
              appointment.id,
              {
                status: 'Skipped',
                skippedAt: now,
                updatedAt: now,
                cancelledBy: 'system',
                cancellationReason: 'Auto-skipped: Grace period exceeded.',
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
            result.skippedAppointmentIds.push(appointment.id);
            result.processed++;
          }
        });

        // 4. TRIGGER ONE VACUUM PER SESSION
        if (first.slotIndex !== undefined && first.sessionIndex !== undefined) {
          await this.bubblingService.reoptimize({
            sessionIndex: first.sessionIndex,
            doctorId: first.doctorId,
            clinicId: first.clinicId,
            date: first.date,
          });
        }

        console.log(`[GracePeriodSweep] Batch-skipped ${appts.length} appointments for doctor ${first.doctorId}`);
      } catch (err: any) {
        console.error(`[GracePeriodSweep] Batch failed for ${key}:`, err.message);
        result.errors.push(`${key}: ${err.message}`);
      }
    }

    return result;
  }
}
