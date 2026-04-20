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

    // Calculate numeric token with offset guards
    let numericToken: number;
    let prefix: string;

    if (isPriority) {
      prefix = 'PW-';
      numericToken = result; // PW starts from 1, 2, 3 independently
    } else if (type === 'W') {
      prefix = 'W-';
      // W-Tokens start AFTER the session slots to prevent visual confusion
      numericToken = Math.max(100, totalSessionSlots) + result;
    } else {
      // Fallback for A-tokens if slotIndex was missing (safety only)
      prefix = 'A-';
      numericToken = result;
    }
    
    const tokenNumber = `${prefix}${String(numericToken).padStart(3, '0')}`;
    return { tokenNumber, numericToken };
  }
}
