import { addMinutes, format } from 'date-fns';
import { Appointment, Doctor } from '../../../../packages/shared/src/index';
import { IAppointmentRepository, IDoctorRepository, ITransaction } from '../../domain/repositories';
import { sseService } from './SSEService';
import { DelayCalculatorService } from './DelayCalculatorService';
import { SlotCalculator } from './SlotCalculator';

/**
 * QueueBubblingService
 *
 * Responsible for moving W-Tokens (Walk-in patients) into vacated slots
 * after a Skip, Cancel, or No-show event.
 *
 * SAFETY INVARIANT: ONLY W-Tokens are eligible for bubbling.
 * A-Tokens (bookedVia === 'Advanced Booking') are IMMUTABLE — their
 * scheduled time is a promise made to the patient. This filter is
 * enforced at the code level to prevent junior-developer mistakes.
 *
 * CONCURRENCY: The full reoptimize() scan and write MUST run inside a
 * Firestore transaction. If two Skip events fire simultaneously, Firestore's
 * optimistic concurrency will retry the second thread with fresh data,
 * ensuring both gaps are filled without a double-assignment.
 */
export class QueueBubblingService {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository
  ) {}

  /**
   * Scans the entire session for vacant slots and pulls ALL eligible W-Tokens forward.
   * This is the "Vacuum" engine that ensures a dense queue even after mass vacancies.
   *
   * @param sessionIndex     - The session to re-optimize.
   * @param doctorId         - The doctor for this session.
   * @param clinicId         - The clinic for SSE broadcasting.
   * @param date             - Firestore date string ('d MMMM yyyy').
   */
  async reoptimize(params: {
    vacatedSlotIndex?: number; // Optional hint, used to start the scan
    sessionIndex: number;
    doctorId: string;
    clinicId: string;
    date: string;
  }): Promise<void> {
    const { sessionIndex, doctorId, clinicId, date } = params;

    await this.appointmentRepo.runTransaction(async (txn: ITransaction) => {
      const doctor = await this.doctorRepo.findById(doctorId);
      if (!doctor) return;

      const allAppointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, date);
      const sessionAppointments = allAppointments.filter(
        a => a.sessionIndex === sessionIndex && !a.isDeleted
      );

      const reslottedEvents: any[] = [];
      let hasMutated = true;

      // Iterative Vacuum Sweep
      while (hasMutated) {
        hasMutated = false;

        // 1. Identify all current gaps in the session
        // A gap exists at slot index 'i' if:
        // - There is no Confirmed/InConsultation appointment at 'i'
        // - AND there is at least one Confirmed appointment at some 'j' where 'j > i'
        const activeAppts = sessionAppointments.filter(a => 
          a.status === 'Confirmed' || a.status === 'InConsultation' || a.status === 'Completed'
        );
        const occupiedIndices = new Set(activeAppts.map(a => a.slotIndex!));
        const maxOccupiedIndex = occupiedIndices.size > 0 ? Math.max(...occupiedIndices) : -1;

        if (maxOccupiedIndex <= 0) break;

        // Find the earliest gap
        let earliestGap = -1;
        for (let i = 0; i < maxOccupiedIndex; i++) {
          if (!occupiedIndices.has(i)) {
            earliestGap = i;
            break;
          }
        }

        if (earliestGap === -1) break; // No gaps found below the max index

        // 2. Find W-Token candidates to fill this specific gap
        const candidates = sessionAppointments
          .filter(a =>
            a.bookedVia === 'Walk-in' &&
            a.status === 'Confirmed' &&
            a.slotIndex! > earliestGap
          )
          .sort((a, b) => a.slotIndex! - b.slotIndex!);

        if (candidates.length === 0) break;

        // 3. Promote the earliest candidate into the gap
        const candidate = candidates[0];
        const oldSlotIndex = candidate.slotIndex!;
        
        // Find the time for the new slot index
        const slots = SlotCalculator.generateSlots(doctor, new Date(date));
        const targetSlot = slots.find(s => s.index === earliestGap);
        
        const getClinicTimeString = (date: Date) => {
          return format(date, 'HH:mm');
        };

        if (targetSlot) {
          candidate.slotIndex = earliestGap;
          candidate.time = getClinicTimeString(targetSlot.time);
          candidate.updatedAt = new Date();

          await this.appointmentRepo.update(candidate.id, {
            slotIndex: earliestGap,
            time: candidate.time,
            updatedAt: candidate.updatedAt
          }, txn);
        } else {
          // Fallback for overtime slots (rare during bubbling but defensive)
          const lastSlot = slots[slots.length - 1];
          const avgTime = doctor.averageConsultingTime || 15;
          const virtualTime = addMinutes(lastSlot.time, avgTime * (earliestGap - lastSlot.index));
          
          candidate.slotIndex = earliestGap;
          candidate.time = getClinicTimeString(virtualTime);
          candidate.updatedAt = new Date();

          await this.appointmentRepo.update(candidate.id, {
            slotIndex: earliestGap,
            time: candidate.time,
            updatedAt: candidate.updatedAt
          }, txn);
        }

        reslottedEvents.push({
          appointmentId: candidate.id,
          patientId: candidate.patientId,
          patientName: candidate.patientName,
          tokenNumber: candidate.tokenNumber,
          oldSlotIndex,
          newSlotIndex: earliestGap,
          newTime: candidate.time
        });

        console.log(`[QueueBubbling] Vacuum: Promoted ${candidate.tokenNumber} from ${oldSlotIndex} to ${earliestGap}`);
        hasMutated = true; // Continue sweeping
      }

      // 4. BATCHED BROADCAST: Fire once per transaction commit
      if (reslottedEvents.length > 0) {
        // Pulse Calculation: Add live delay to payload
        let liveDelayMinutes = 0;
        if (doctor) {
          liveDelayMinutes = DelayCalculatorService.calculate({
            doctor,
            appointments: allAppointments,
            now: new Date(),
            sessionIndex
          });
        }

        // Fetch fresh state of session for the broadcast to ensure zero lag
        const updatedAppointments = sessionAppointments.map(a => ({...a})); 

        sseService.emit('queue_reoptimized', clinicId, {
          doctorId,
          sessionIndex,
          reslottedCount: reslottedEvents.length,
          updatedQueue: updatedAppointments,
          liveDelayMinutes
        });
      }
    });
  }
}
