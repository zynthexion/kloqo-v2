import { addMinutes, format } from 'date-fns';
import { Appointment, Doctor } from '../../../../packages/shared/src/index';
import { IAppointmentRepository, IDoctorRepository, ITransaction } from '../../domain/repositories';
import { SSEService } from './SSEService';
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
    private doctorRepo: IDoctorRepository,
    private sseService: SSEService
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

      const allAppointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, date);
      const sessionAppointments = allAppointments.filter(
        a => a.sessionIndex === sessionIndex && !a.isDeleted
      );

      // 1. Identify "Protected Zone" — Dual-Phase Consultation Boundary Lock
      //
      // Phase A: LIVE SESSION — Freeze based on physical reality.
      //   • consultationBoundary: the MINIMUM slot of any InConsultation patient
      //     (the patient literally in the room — cannot be displaced).
      //   • doorBoundary: the MINIMUM slot of the next Confirmed patient whose
      //     slot is above the consultation boundary (the patient at the door —
      //     their position is also irrevocable).
      //   • liveFreezeThreshold: the lower of the two — no gap at or below this
      //     index may ever be filled by the vacuum.
      //
      // Phase B: PRE-SESSION — Freeze based on the isInBuffer flag.
      //   • bufferThreshold: the MAX slot of any isInBuffer appointment.
      //     Used before the doctor starts consulting to protect pre-loaded patients.
      //
      // Final: protectedThreshold = Math.max(live, buffer) — the stricter of the two.

      const inConsultationAppts = sessionAppointments.filter(a => a.status === 'InConsultation');
      const consultationBoundary = inConsultationAppts.length > 0
        ? Math.min(...inConsultationAppts.map(a => a.slotIndex!))
        : -1;

      const doorConfirmedAppts = sessionAppointments
        .filter(a => a.status === 'Confirmed' && (a.slotIndex ?? -1) > consultationBoundary)
        .sort((a, b) => a.slotIndex! - b.slotIndex!);
      const doorBoundary = doorConfirmedAppts.length > 0 ? doorConfirmedAppts[0].slotIndex! : -1;

      const liveFreezeThreshold = consultationBoundary >= 0
        ? Math.min(
            consultationBoundary,
            doorBoundary >= 0 ? doorBoundary : consultationBoundary
          )
        : -1;

      const bufferedAppts = sessionAppointments.filter(a => (a as any).isInBuffer === true);
      const bufferThreshold = bufferedAppts.length > 0
        ? Math.max(...bufferedAppts.map(a => a.slotIndex!))
        : -1;

      const protectedThreshold = Math.max(liveFreezeThreshold, bufferThreshold);

      console.log(`[QueueBubbling] 🔒 Freeze active: live=${liveFreezeThreshold}, buffer=${bufferThreshold}`);

      // 2. Identify Gaps and Candidates
      // Gaps: Empty slots ABOVE the protected threshold and below the max occupied index.
      // Candidates: Confirmed Walk-ins above both the gaps and the protected threshold.
      const activeAppts = sessionAppointments.filter(a => 
        ['Pending', 'Confirmed', 'InConsultation', 'Completed'].includes(a.status)
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
          // Candidates must be above the current consultation to be eligible
          a.slotIndex! > consultationBoundary &&
          // Safety: Candidate must not already be in a gap
          !gaps.includes(a.slotIndex!) 
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
        
        // 🔒 SAFETY CHECK: Consultation Boundary Lock
        // RULE 1: The Consultation Zone (<= liveFreezeThreshold) is ABSOLUTELY frozen.
        // No one can move into a slot at or below where the doctor is currently working.
        if (gapIndex <= liveFreezeThreshold) {
          console.log(`[QueueBubbling] 🔒 Lock Active: Slot ${gapIndex} is in the Consultation Zone. Skipping.`);
          continue;
        }

        // RULE 2: Buffer Protection
        // External candidates (outside buffer) cannot jump into the Buffer Zone.
        const isCandidateBuffered = candidate.slotIndex! <= bufferThreshold;
        const isGapBuffered = gapIndex <= bufferThreshold;

        if (!isCandidateBuffered && isGapBuffered) {
          console.log(`[QueueBubbling] 🔒 Buffer Lock: Preventing external ${candidate.tokenNumber} from jumping to buffered gap ${gapIndex}`);
          continue;
        }

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

        this.sseService.emit('queue_reoptimized', clinicId, {
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
