import { addMinutes, isBefore, format } from "date-fns";
import { Appointment, Doctor } from "@kloqo/shared";

export type MockSlot = {
  slotIndex: number;
  time: Date;
  sessionIndex: number;
  type: 'A' | 'W' | 'P' | 'B'; // Advanced, Walk-in, Priority, Blocked/Buffer
  appointment?: Partial<Appointment>;
  isReserved?: boolean;
};

export class V2PreviewScheduler {
  /**
   * Generates a preview of how slots would be distributed based on V2 logic.
   */
  static generatePreview(params: {
    doctor: Doctor;
    date: Date;
    sessionIndex: number;
    mockAppointments: Partial<Appointment>[];
    strategyOverride?: 'classic' | 'advanced';
    allotmentOverride?: number;
    ratioOverride?: number;
  }): MockSlot[] {
    const { doctor, date, sessionIndex, mockAppointments, strategyOverride, allotmentOverride, ratioOverride } = params;
    
    // 1. Resolve Parameters (Hierarchy: Override > Doctor > Clinic/System)
    const strategy = strategyOverride || doctor.tokenDistribution || 'advanced';
    const allotment = allotmentOverride ?? (doctor.walkInTokenAllotment || 5);
    const ratio = ratioOverride ?? (doctor.walkInReserveRatio || 0.15);
    const slotDuration = doctor.averageConsultingTime || 15;

    // 2. Generate Nominal Slots for the session
    const dayName = format(date, 'EEEE');
    const availability = doctor.availabilitySlots?.find(s => s.day === dayName);
    const session = availability?.timeSlots?.[sessionIndex];
    if (!session) return [];

    const startTime = new Date(date);
    const [hStart, mStart] = session.from.split(':').map(Number);
    startTime.setHours(hStart, mStart, 0, 0);

    const endTime = new Date(date);
    const [hEnd, mEnd] = session.to.split(':').map(Number);
    endTime.setHours(hEnd, mEnd, 0, 0);

    const nominalSlots: MockSlot[] = [];
    let current = new Date(startTime);
    let idx = 0;

    while (isBefore(current, endTime)) {
      nominalSlots.push({
        slotIndex: (sessionIndex * 1000) + idx,
        time: new Date(current),
        sessionIndex,
        type: 'A', // Default to Advanced
      });
      current = addMinutes(current, slotDuration);
      idx++;
    }

    // 3. Apply Strategy Logic
    if (strategy === 'classic') {
      // CLASSIC: The Zipper
      // Reserve every Nth slot for walk-ins
      nominalSlots.forEach((slot, i) => {
        if ((i + 1) % allotment === 0) {
          slot.type = 'W';
          slot.isReserved = true;
        }
      });
    } else {
      // ADVANCED: The Buffer
      // Reserve the last X% of slots as buffers
      const bufferCount = Math.ceil(nominalSlots.length * ratio);
      const startBufferIdx = nominalSlots.length - bufferCount;
      nominalSlots.forEach((slot, i) => {
        if (i >= startBufferIdx) {
          slot.type = 'B';
          slot.isReserved = true;
        }
      });
    }

    // 4. Map Mock Appointments to Slots
    // We process mock appointments to simulate the PLACEMENT logic.
    // NOTE: This simulation logic now matches the 'Pure Greedy' backend behavior for Classic Mode.
    const occupiedSlotIndices = new Set<number>();
    
    // Sort mock appointments (Advanced first, then Walk-ins to simulate arrival/booking order)
    const sortedAppts = [...mockAppointments].sort((a, b) => {
      if (a.bookedVia !== b.bookedVia) {
        return a.bookedVia === 'Advanced Booking' ? -1 : 1;
      }
      return 0; // Simple order for simulation
    });

    sortedAppts.forEach(appt => {
      // If it has a specific slotIndex (manual placement), use it
      if (typeof appt.slotIndex === 'number') {
        const slot = nominalSlots.find(s => s.slotIndex === appt.slotIndex);
        if (slot) {
          slot.appointment = appt;
          occupiedSlotIndices.add(slot.slotIndex);
          if (appt.bookedVia === 'Walk-in') slot.type = 'W';
          if (appt.tokenNumber?.startsWith('PW-')) slot.type = 'P';
        }
        return;
      }

      // If it's a Walk-in without a slotIndex, simulate the PREEDY placement
      if (appt.bookedVia === 'Walk-in') {
        const zipperPositions = new Set<number>();
        if (strategy === 'classic') {
          const modulus = allotment;
          for (let i = allotment - 1; i < nominalSlots.length; i += modulus) {
             zipperPositions.add(nominalSlots[i].slotIndex);
          }
        }

        const targetSlot = nominalSlots.find(slot => {
          if (occupiedSlotIndices.has(slot.slotIndex)) return false;
          
          if (strategy === 'classic') {
            // Rule: Target Zipper OR any empty gap (Greedy Front-Fill)
            return zipperPositions.has(slot.slotIndex) || !slot.appointment;
          } else {
            // Advanced Mode: Buffer simulation
            return slot.type === 'B' || !slot.appointment;
          }
        });

        if (targetSlot) {
          targetSlot.appointment = appt;
          occupiedSlotIndices.add(targetSlot.slotIndex);
          targetSlot.type = 'W';
        }
      }
    });

    return nominalSlots;
  }

  /**
   * Simulates the 'Vacuum' (Bubbling) effect
   * If a slot is missing an appointment or has a terminal state, 
   * pull the next available walk-in forward.
   */
  static simulateBubbling(slots: MockSlot[]): MockSlot[] {
    // This is a simplified version for visualization
    const processed = [...slots];
    // TODO: Implement sophisticated shifting if needed for developer demo
    return processed;
  }
}
