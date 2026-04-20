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
   * Classic Mode: Assign the permanent numeric calling token at booking time.
   * This ensures the 'Fixed Promise' — your place in line is secured purely
   * by your slot selection, not your arrival time.
   */
  async generateBookingToken(params: BookingTokenParams, transaction?: any): Promise<TokenResult | null> {
    const { clinicId, doctorId, doctorName, date, sessionIndex, slotIndex } = params;

    const result = await this.tokenGenerator.generateToken(
      clinicId,
      doctorId,
      doctorName,
      date,
      'A',
      sessionIndex,
      'classic',
      transaction,
      0, // totalSessionSlots not strictly needed for A-tokens here
      false, // isPriority
      slotIndex
    );

    return result;
  }

  /**
   * Classic Mode: Idempotent no-op.
   * The token is now assigned at booking. This method remains for interface
   * parity and returns the existing token number.
   */
  async generateArrivalToken(params: ArrivalTokenParams): Promise<string | null> {
    const { existingClassicTokenNumber } = params;

    // The token is already assigned at booking source
    return existingClassicTokenNumber || null;
  }
}
