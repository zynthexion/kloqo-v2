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
     * Used by W-Tokens to compute a collision-safe numeric offset:
     *   offset = Math.max(100, totalSessionSlots)
     * This guarantees W-token numbers always sit above A-token numbers
     * even for large (100+ slot) sessions.
     * Defaults to 0 → falls back to legacy flat +100.
     */
    totalSessionSlots: number = 0
  ): Promise<{ tokenNumber: string; numericToken: number }> {
    const isClassic = tokenDistribution === 'classic';
    let counterDocId: string;

    if (isClassic) {
      counterDocId = `classic_${clinicId}_${doctorName}_${date}_s${sessionIndex}`;
    } else {
      counterDocId = `${clinicId}_${doctorName}_${date}${type === 'W' ? '_W' : ''}`;
    }

    const result = await this.appointmentRepo.incrementTokenCounter(counterDocId, isClassic, transaction);

    if (isClassic) {
      const tokenNumber = String(result).padStart(3, '0');
      return { tokenNumber, numericToken: result };
    }

    // Dynamic Base Offset: the numericToken for W-tokens must always be higher
    // than any possible A-token (which equals slotIndex+1, max = totalSessionSlots).
    // Math.max(100, totalSessionSlots) gives us a guaranteed safe floor.
    const numericPart = type === 'W'
      ? Math.max(100, totalSessionSlots) + result
      : result;
    const tokenNumber = `${type}${String(numericPart).padStart(3, '0')}`;

    return { tokenNumber, numericToken: numericPart };
  }
}
