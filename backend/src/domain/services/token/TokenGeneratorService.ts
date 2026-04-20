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
    totalSessionSlots: number = 0,
    isPriority: boolean = false
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
      const numericPart = result;
      const prefix = isPriority ? 'PW-' : '';
      const tokenNumber = `${prefix}${String(numericPart).padStart(3, '0')}`;
      return { tokenNumber, numericToken: numericPart };
    }

    const numericPart = type === 'W'
      ? Math.max(100, totalSessionSlots) + result
      : result;
    
    const prefix = isPriority ? 'PW' : type;
    const tokenNumber = `${prefix}${String(numericPart).padStart(3, '0')}`;

    return { tokenNumber, numericToken: numericPart };
  }
}
