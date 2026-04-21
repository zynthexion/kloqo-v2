import { IAppointmentRepository } from '../../repositories';

export class TokenGeneratorService {
  constructor(private appointmentRepo: IAppointmentRepository) {}

  async generateToken(
    clinicId: string,
    _doctorId: string,
    doctorName: string,
    date: string,
    type: 'A' | 'W',
    sessionIndex: number,
    tokenDistribution: 'classic' | 'advanced' = 'advanced',
    transaction?: any,
    /**
     * Total number of physical slots in the session.
     * Used by W-Tokens to compute a collision-safe numeric offset.
     */
    totalSessionSlots: number = 0,
    isPriority: boolean = false,
    slotIndex?: number
  ): Promise<{ tokenNumber: string; numericToken: number }> {
    const isClassic = tokenDistribution === 'classic';
    
    // 🔍 SELECTION LOGIC: A-Tokens are derived from Slot Position
    if (type === 'A' && typeof slotIndex === 'number' && !isPriority) {
      const numericPart = slotIndex + 1;
      const tokenNumber = `A-${String(numericPart).padStart(3, '0')}`;
      return { tokenNumber, numericToken: numericPart };
    }

    // 🔍 COUNTER LOGIC: W-Tokens and PW-Tokens use the Atomic Counter
    let counterDocId: string;
    if (isClassic) {
      counterDocId = `classic_${clinicId}_${doctorName}_${date}_s${sessionIndex}${isPriority ? '_PW' : (type === 'W' ? '_W' : '')}`;
    } else {
      counterDocId = `${clinicId}_${doctorName}_${date}${isPriority ? '_PW' : (type === 'W' ? '_W' : '')}`;
    }

    const result = await this.appointmentRepo.incrementTokenCounter(counterDocId, isClassic, transaction);

    // 🚑 PRIORITY TRIAGE: PW-Tokens MUST use an independent sequence (PW-001, PW-002)
    // They never inherit session offsets to signal urgency to the waiting room.
    let numericToken: number;
    let prefix: string;

    if (isPriority) {
      prefix = 'PW-';
      numericToken = result; // Strictly sequential from 1
    } else if (type === 'W') {
      prefix = 'W-';
      // W-Tokens start AFTER physical capacity to prevent visual confusion
      numericToken = Math.max(100, totalSessionSlots) + result;
    } else {
      prefix = 'A-';
      numericToken = result;
    }
    
    // ⚠️ ARCHITECT'S MANDATE: "Dropping the hyphen" is forbidden.
    // Unified Alphanumeric Base-100 Standard: [Prefix]-[XXX]
    const tokenNumber = `${prefix}${String(numericToken).padStart(3, '0')}`;
    return { tokenNumber, numericToken };
  }
}
