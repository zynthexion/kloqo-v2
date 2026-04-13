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
    transaction?: any
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

    // For advanced distribution, we match the legacy format (e.g. A001, W101)
    // Legacy logic for walk-ins adds 100 to the counter
    const numericPart = type === 'W' ? result + 100 : result;
    const tokenNumber = `${type}${String(numericPart).padStart(3, '0')}`;
    
    return { tokenNumber, numericToken: numericPart };
  }
}
