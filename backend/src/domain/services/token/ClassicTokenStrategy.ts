/**
 * Classic Token Strategy
 * 
 * For 'classic' token distribution.
 * 
 * - Booking time: returns null — NO token is assigned at booking.
 * - Arrival time: assigns the next sequential arrival number (001, 002...)
 *   based on physical arrival order, not booking order.
 * 
 * This matches the legacy behavior exactly:
 *   - getClassicTokenCounterId + prepareNextClassicTokenNumber
 *   - Called only when appointment status → 'Confirmed'
 */

import { ITokenStrategy, BookingTokenParams, ArrivalTokenParams, TokenResult } from './ITokenStrategy';
import { TokenGeneratorService } from './TokenGeneratorService';

export class ClassicTokenStrategy implements ITokenStrategy {
  constructor(private tokenGenerator: TokenGeneratorService) {}

  /**
   * Classic mode: no token at booking. Return null.
   * The classicTokenNumber only exists once the patient physically arrives.
   */
  async generateBookingToken(_params: BookingTokenParams): Promise<null> {
    return null;
  }

  async generateArrivalToken(params: ArrivalTokenParams): Promise<string | null> {
    const { clinicId, doctorId, doctorName, date, sessionIndex, existingClassicTokenNumber } = params;

    // Idempotent: if already assigned, return it unchanged
    if (existingClassicTokenNumber) {
      return existingClassicTokenNumber;
    }

    const result = await this.tokenGenerator.generateToken(
      clinicId,
      doctorId,
      doctorName,
      date,
      'A',
      sessionIndex,
      'classic'
    );

    return result.tokenNumber;
  }
}
