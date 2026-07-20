import { IClinicRepository, IDoctorRepository, IAppointmentRepository, IConsultationCounterRepository } from '../domain/repositories';
import { Appointment, compareAppointments, compareAppointmentsClassic } from '../../../packages/shared/src/index';
import { SlotCalculator } from '../domain/services/SlotCalculator';
import { BookingSessionEngine } from '../domain/services/BookingSessionEngine';
import { getClinicNow, getClinicISOString, parseClinicDate } from '../domain/services/DateUtils';

export interface PublicQueueStatus {
  clinic: {
    id: string;
    name: string;
    tokenDistribution: 'classic' | 'advanced';
    address?: string;
  };
  doctor: {
    id: string;
    name: string;
    consultationStatus: 'In' | 'Out' | string;
    currentSessionIndex?: number;
    consultationCount?: number;
  };
  queue: {
    arrivedCount: number;
    patientsAhead: number;
    currentToken: string | null;
    yourTurn: boolean;
    isDoctorIn: boolean;
    estimatedWaitTime: number;
    breakMinutes: number;
    masterQueue: any[];
  };
  // To keep parity with what frontend expects
  currentTokenAppointment: any | null;
}

export class GetPublicQueueStatusUseCase {
  constructor(
    private clinicRepo: IClinicRepository,
    private doctorRepo: IDoctorRepository,
    private appointmentRepo: IAppointmentRepository,
    private consultationCounterRepo: IConsultationCounterRepository
  ) {}

  async execute(clinicId: string, doctorId: string, date: string, patientId?: string): Promise<PublicQueueStatus> {
    const [clinic, doctor, appointments] = await Promise.all([
      this.clinicRepo.findById(clinicId),
      this.doctorRepo.findById(doctorId, clinicId),
      this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, date)
    ]);

    if (!clinic || !doctor) {
      throw new Error('Clinic or Doctor not found');
    }

    const now = new Date();
    const todayStrIst = getClinicISOString(now);
    const todayBaselineIst = parseClinicDate(todayStrIst);
    const requestedDate = parseClinicDate(date);

    const tokenDistribution = doctor.tokenDistribution || clinic.tokenDistribution || 'advanced';
    
    // ── Session & Consultation logic ───────────────────────────────────────────
    let consultationCount = 0;
    let activeSessionIndex: number | null = null;
    
    // We only fetch counters for "Today" active sessions
    const isToday = requestedDate.setHours(0,0,0,0) === todayBaselineIst.getTime();
    
    if (isToday) {
      const allSlotsForSession = SlotCalculator.generateSlots(doctor, requestedDate);
      activeSessionIndex = BookingSessionEngine.findActiveSession(
        doctor,
        allSlotsForSession,
        appointments,
        now,
        tokenDistribution as 'classic' | 'advanced'
      );
      
      if (activeSessionIndex !== null) {
        consultationCount = await this.consultationCounterRepo.getCount(clinicId, doctorId, date, activeSessionIndex);
      }
    }

    // ANALYTICS GUARDRAIL: Strip system-generated ghost break-blocker records
    // before any queue logic runs. These records exist to block the scheduling
    // engine and must never be visible to patients or counted in queue metrics.
    const realAppointments = appointments.filter(a => !a.isSystemBlocker);

    // 1. Unified Active Queue (Includes InConsultation, Confirmed, and Pending)
    const activeQueue = realAppointments
      .filter(apt => ['Confirmed', 'InConsultation', 'Pending'].includes(apt.status) && apt.conflictStatus !== 'PENDING')
      .sort(tokenDistribution === 'advanced' ? compareAppointments : compareAppointmentsClassic);

    // 2. Arrived Queue (subset for current consultation fallback)
    const arrivedOnlyQueue = activeQueue.filter(apt => apt.status !== 'Pending');
    
    // 3. Subsets for tracking (based on active queue)
    const priorityQueue = activeQueue.filter(apt => apt.isPriority);
    const bufferQueue = activeQueue.filter(apt => apt.isInBuffer);
    
    // 4. Current Consultation (Ground Truth)
    // We strictly prioritize InConsultation. Fallback to top of arrived queue if doctor is 'In'.

    // Ensure we have availability for slot generation
    if (!doctor.availabilitySlots || doctor.availabilitySlots.length === 0) {
      console.log(`[QueueStatus] Doctor ${doctorId} has no availabilitySlots. Attempting to fetch full profile.`);
      // The doctor object from the repository should already have these, 
      // but we double-check or the SlotCalculator will return empty.
    }

    let currentConsultation = realAppointments.find(apt => apt.status === 'InConsultation') || null;
    
    if (!currentConsultation && doctor.consultationStatus === 'In' && arrivedOnlyQueue.length > 0) {
      currentConsultation = arrivedOnlyQueue[0];
    }

    const allSlots = SlotCalculator.generateSlots(doctor, requestedDate);
    console.log(`[QueueStatus] Generated ${allSlots.length} slots for doctor ${doctor.name}`);
    const currentSlotIndex = currentConsultation?.slotIndex ?? -1;

    // Calculate patients ahead for the specific patient
    let patientsAhead = 0;
    let yourTurn = false;
    if (patientId) {
      const yourApt = realAppointments.find(a => a.patientId === patientId && ['Confirmed', 'Pending'].includes(a.status));
      if (yourApt) {
        if (currentConsultation?.id === yourApt.id) {
          yourTurn = true;
          patientsAhead = 0;
        } else {
          // USER'S STABILITY ALGORITHM:
          // Instead of counting patients, we count "Slots Ahead" + "Extra Patients".
          
          const targetSlotIndex = yourApt.slotIndex ?? 0;

          console.log(`[QueueAhead] Patient ${yourApt.tokenNumber} (Slot ${targetSlotIndex}), Inside: ${currentConsultation?.tokenNumber} (Slot ${currentSlotIndex})`);

          // 1. Start with the person currently inside (if any and not you)
          patientsAhead = currentConsultation ? 1 : 0;
          console.log(`[QueueAhead] Starting count (Inside): ${patientsAhead}`);

          // 2. Count slots that are NOT passed and are BEFORE your target slot
          const slotsAhead = allSlots.filter(s => s.index > currentSlotIndex && s.index < targetSlotIndex);
          patientsAhead += slotsAhead.length;
          console.log(`[QueueAhead] Added slots ahead: ${slotsAhead.length} (Total: ${patientsAhead})`);

          // 2. Add extra appointments in those slots (e.g. force booked > 1)
          for (const slot of slotsAhead) {
            const apptsInSlot = activeQueue.filter(a => a.slotIndex === slot.index);
            if (apptsInSlot.length > 1) {
                const extra = apptsInSlot.length - 1;
                patientsAhead += extra;
                console.log(`[QueueAhead] Slot ${slot.index} has ${apptsInSlot.length} appts. Adding +${extra}`);
            }
          }

          // 3. Handle the "Current Slot" (people waiting in the same slot as current consultation)
          const inCurrentSlot = activeQueue.filter(a => a.slotIndex === currentSlotIndex);
          const currentAptIdxInCurrentSlot = inCurrentSlot.findIndex(a => a.id === currentConsultation?.id);
          if (currentAptIdxInCurrentSlot !== -1) {
             const extraCurrent = inCurrentSlot.length - currentAptIdxInCurrentSlot - 1;
             patientsAhead += extraCurrent;
             console.log(`[QueueAhead] Current slot ${currentSlotIndex} has ${extraCurrent} others waiting.`);
          } else {
             patientsAhead += inCurrentSlot.length;
             console.log(`[QueueAhead] Current slot ${currentSlotIndex} has ${inCurrentSlot.length} people waiting (consultation not in active list).`);
          }

          // 4. Handle "Your Slot" (people waiting in the same slot as you but ahead of you)
          const inYourSlot = activeQueue.filter(a => a.slotIndex === targetSlotIndex);
          const yourPosInYourSlot = inYourSlot.findIndex(a => a.id === yourApt.id);
          if (yourPosInYourSlot !== -1) {
              patientsAhead += yourPosInYourSlot;
              console.log(`[QueueAhead] Your slot ${targetSlotIndex}: You are at pos ${yourPosInYourSlot}. Adding +${yourPosInYourSlot}`);
          }

          console.log(`[QueueAhead] FINAL Patients Ahead: ${patientsAhead}`);
        }
      }
    }

    // 5. Calculate Wait Time and Breaks (Dumb Frontend Mandate)
    const avgTime = doctor.averageConsultingTime || 15;
    const estimatedWaitTime = patientsAhead * avgTime;
    
    // Break calculation: If doctor is Out/Break, find the remaining time of current break
    let breakMinutes = 0;
    if (doctor.consultationStatus === 'Break' || doctor.consultationStatus === 'Out') {
        // Simple heuristic: if we are in a session gap or explicit break
        // We look for the next session start if current time is before it
        const currentSession = SlotCalculator.findActiveSessionIndex(doctor, allSlots, now, tokenDistribution, realAppointments);
        if (currentSession !== null) {
            const sessionSlots = allSlots.filter(s => s.sessionIndex === currentSession);
            if (sessionSlots.length > 0) {
                const sessionStart = sessionSlots[0].time;
                if (now < sessionStart) {
                    const diff = Math.ceil((sessionStart.getTime() - now.getTime()) / (1000 * 60));
                    breakMinutes = Math.max(0, diff);
                }
            }
        }
    }

    return {
      clinic: {
        id: clinic.id,
        name: clinic.name,
        tokenDistribution: tokenDistribution as 'classic' | 'advanced',
        address: clinic.address
      },
      doctor: {
        id: doctor.id,
        name: doctor.name,
        consultationStatus: doctor.consultationStatus || 'Out',
        currentSessionIndex: activeSessionIndex ?? undefined,
        consultationCount
      },
      queue: {
        arrivedCount: arrivedOnlyQueue.length,
        patientsAhead,
        currentToken: tokenDistribution === 'classic' 
          ? currentConsultation?.classicTokenNumber?.toString() || null
          : currentConsultation?.tokenNumber || null,
        yourTurn,
        isDoctorIn: doctor.consultationStatus === 'In',
        estimatedWaitTime,
        breakMinutes,
        // Sanitized slot-based masterQueue for stable feed (NESTED HERE)
        masterQueue: (() => {
          const slotsFromCurrent = allSlots.filter(s => s.index >= currentSlotIndex);
          const feedQueue: any[] = [];
          
          // Include Pending patients in the feed search as well
          const feedAppointments = realAppointments.filter(a => ['Confirmed', 'Pending', 'InConsultation'].includes(a.status) && a.conflictStatus !== 'PENDING');

          // Take the first 15 slots starting from the current one to show in the feed
          for (const slot of slotsFromCurrent.slice(0, 15)) {
            const appts = feedAppointments.filter(a => a.slotIndex === slot.index);
            
            if (appts.length === 0) {
              // It's a hole (Expecting Patient)
              feedQueue.push({
                id: `hole-${slot.index}`,
                status: 'Empty',
                slotIndex: slot.index,
                tokenNumber: `S-${slot.index + 1}` // Placeholder token
              });
            } else {
              appts.forEach(a => {
                feedQueue.push({
                  id: a.id,
                  tokenNumber: a.tokenNumber,
                  classicTokenNumber: a.classicTokenNumber,
                  status: a.status,
                  isPriority: a.isPriority,
                  slotIndex: a.slotIndex
                });
              });
            }
          }
          return feedQueue;
        })()
      },
      currentTokenAppointment: currentConsultation ? {
        id: currentConsultation.id,
        tokenNumber: currentConsultation.tokenNumber,
        classicTokenNumber: currentConsultation.classicTokenNumber,
        status: currentConsultation.status
      } : null
    };
  }
}
