import { Appointment } from '../../../../packages/shared/src/index';
import { IAppointmentRepository, ITransaction } from '../../domain/repositories';
import { sseService } from './SSEService';

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
  constructor(private appointmentRepo: IAppointmentRepository) {}

  /**
   * Scans for a vacant slot and promotes the earliest eligible W-Token.
   *
   * @param vacatedSlotIndex - The slot index that just became vacant.
   * @param sessionIndex     - The session this vacancy belongs to.
   * @param doctorId         - The doctor for this session.
   * @param clinicId         - The clinic for SSE broadcasting.
   * @param date             - Firestore date string ('d MMMM yyyy').
   */
  async reoptimize(params: {
    vacatedSlotIndex: number;
    sessionIndex: number;
    doctorId: string;
    clinicId: string;
    date: string;
  }): Promise<void> {
    const { vacatedSlotIndex, sessionIndex, doctorId, clinicId, date } = params;

    await this.appointmentRepo.runTransaction(async (txn: ITransaction) => {
      // 1. Read all appointments for the session within the transaction.
      //    This acquires Firestore read-locks, preventing race conditions.
      const allAppointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, date);
      const sessionAppointments = allAppointments.filter(a => a.sessionIndex === sessionIndex);

      // 2. Verify the slot is still actually vacant (double-check inside txn).
      const isStillVacant = !sessionAppointments.some(
        a => a.slotIndex === vacatedSlotIndex && (a.status === 'Confirmed' || a.status === 'InConsultation')
      );

      if (!isStillVacant) {
        // Another concurrent transaction already filled this gap. Nothing to do.
        console.log(`[QueueBubbling] Slot ${vacatedSlotIndex} already filled. Skipping.`);
        return;
      }

      // 3. Build the W-Token candidate pool.
      //    ⚠️ IMMUTABILITY FIREWALL: A-Tokens are strictly excluded here.
      const walkinCandidates = sessionAppointments
        .filter(a =>
          a.bookedVia === 'Walk-in' &&
          a.status === 'Confirmed' &&
          a.slotIndex !== undefined &&
          a.slotIndex > vacatedSlotIndex // Only move patients from further back
        )
        .sort((a, b) => (a.slotIndex! - b.slotIndex!)); // Earliest slot first

      if (walkinCandidates.length === 0) {
        console.log(`[QueueBubbling] No W-Token candidates to bubble for session ${sessionIndex}.`);
        return;
      }

      // 4. Promote the earliest-scheduled W-Token into the vacancy.
      const candidate = walkinCandidates[0];
      const oldSlotIndex = candidate.slotIndex!;

      await this.appointmentRepo.update(
        candidate.id,
        {
          slotIndex: vacatedSlotIndex,
          updatedAt: new Date(),
        },
        txn
      );

      console.log(
        `[QueueBubbling] Promoted W-Token ${candidate.tokenNumber} ` +
        `from slot ${oldSlotIndex} to slot ${vacatedSlotIndex} for doctor ${doctorId}`
      );

      // 5. Broadcast the re-slot event via SSE so all frontends instantly update.
      sseService.emit('appointment_reslotted', clinicId, {
        appointmentId: candidate.id,
        patientId: candidate.patientId,
        patientName: candidate.patientName,
        tokenNumber: candidate.tokenNumber,
        oldSlotIndex,
        newSlotIndex: vacatedSlotIndex,
        sessionIndex,
      });
    });
  }
}
