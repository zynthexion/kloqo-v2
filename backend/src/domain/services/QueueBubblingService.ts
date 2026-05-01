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
    vacatedSlotIndex?: number;
    sessionIndex: number;
    doctorId: string;
    clinicId: string;
    date: string;
    transaction?: ITransaction; // Optional: use existing txn if provided
  }): Promise<void> {
    const { sessionIndex, doctorId, clinicId, date, transaction } = params;

    const runWithTxn = async (txn: ITransaction) => {
      const doctor = await this.doctorRepo.findById(doctorId, clinicId);
      if (!doctor) return;

      const allAppointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, date);
      const sessionAppointments = allAppointments.filter(
        a => a.sessionIndex === sessionIndex && !a.isDeleted
      );

      // 1. Identify "Protected Zone"
      // Patients currently InConsultation or already in the buffer cannot be moved.
      const bufferedAppts = sessionAppointments.filter(a => 
        a.status === 'InConsultation' || (a as any).isInBuffer === true
      );
      const protectedThreshold = bufferedAppts.length > 0 
        ? Math.max(...bufferedAppts.map(a => a.slotIndex!)) 
        : -1;

      // 2. Identify Gaps and Candidates
      // Gaps: Empty slots below the maximum occupied index
      // Candidates: Confirmed Walk-ins above the gaps and protected threshold
      const activeAppts = sessionAppointments.filter(a => 
        ['Confirmed', 'InConsultation', 'Completed'].includes(a.status)
      );
      const occupiedIndices = new Set(activeAppts.map(a => a.slotIndex!));
      const maxOccupiedIndex = occupiedIndices.size > 0 ? Math.max(...occupiedIndices) : -1;

      if (maxOccupiedIndex <= 0) return;

      const gaps: number[] = [];
      for (let i = 0; i <= maxOccupiedIndex; i++) {
        if (!occupiedIndices.has(i)) {
          gaps.push(i);
        }
      }

      if (gaps.length === 0) return;

      const candidates = sessionAppointments
        .filter(a =>
          a.bookedVia === 'Walk-in' &&
          a.status === 'Confirmed' &&
          a.slotIndex! > protectedThreshold &&
          !gaps.includes(a.slotIndex!) // Candidate must not already be in a gap (though shouldn't happen)
        )
        .sort((a, b) => a.slotIndex! - b.slotIndex!);

      if (candidates.length === 0) return;

      const reslottedEvents: any[] = [];
      const slots = SlotCalculator.generateSlots(doctor, new Date(date));
      const getClinicTimeString = (d: Date) => format(d, 'HH:mm');

      // 3. The Vacuum Sweep (Linear Pass)
      // We fill gaps using candidates in FIFO order.
      for (let i = 0; i < Math.min(gaps.length, candidates.length); i++) {
        const gapIndex = gaps[i];
        const candidate = candidates[i];
        
        // Safety: Candidate must be after the gap
        if (candidate.slotIndex! <= gapIndex) continue;

        const oldSlotIndex = candidate.slotIndex!;
        const targetSlot = slots.find(s => s.index === gapIndex);
        
        let newTime = '';
        if (targetSlot) {
          newTime = getClinicTimeString(targetSlot.time);
        } else {
          const lastSlot = slots[slots.length - 1];
          const avgTime = doctor.averageConsultingTime || 15;
          const virtualTime = addMinutes(lastSlot.time, avgTime * (gapIndex - lastSlot.index));
          newTime = getClinicTimeString(virtualTime);
        }

        // ── ATOMIC MIGRATION ──
        // 1. Release Old Lock
        const oldLockId = `${doctorId}_${date}_s${sessionIndex}_slot${oldSlotIndex}`;
        await this.appointmentRepo.releaseSlotLock(oldLockId, txn).catch(() => {});

        // 2. Create New Lock
        const newLockId = `${doctorId}_${date}_s${sessionIndex}_slot${gapIndex}`;
        await this.appointmentRepo.createSlotLock(newLockId, {
          appointmentId: candidate.id,
          doctorId,
          date,
          sessionIndex,
          slotIndex: gapIndex
        }, txn);

        // 3. Update Appointment
        await this.appointmentRepo.update(candidate.id, clinicId, {
          slotIndex: gapIndex,
          time: newTime,
          updatedAt: new Date()
        }, txn);

        // Update local object for the SSE payload
        candidate.slotIndex = gapIndex;
        candidate.time = newTime;

        reslottedEvents.push({
          appointmentId: candidate.id,
          patientId: candidate.patientId,
          tokenNumber: candidate.tokenNumber,
          oldSlotIndex,
          newSlotIndex: gapIndex,
          newTime
        });

        console.log(`[QueueBubbling] Vacuum: Promoted ${candidate.tokenNumber} from ${oldSlotIndex} to ${gapIndex}`);
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
    };

    if (transaction) {
      await runWithTxn(transaction);
    } else {
      await this.appointmentRepo.runTransaction(runWithTxn);
    }
  }
}
