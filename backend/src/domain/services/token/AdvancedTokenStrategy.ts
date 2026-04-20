/**
 * Advanced Token Strategy
 * 
 * For 'advanced' token distribution (Kloqo Advanced).
 * 
 * - Booking time: generates session-prefixed token (A001, A002...) via atomic counter.
 * - Arrival time: no-op — token was already assigned at booking.
 */

import { ITokenStrategy, BookingTokenParams, ArrivalTokenParams, TokenResult } from './ITokenStrategy';
import { TokenGeneratorService } from './TokenGeneratorService';

export class AdvancedTokenStrategy implements ITokenStrategy {
  constructor(private tokenGenerator: TokenGeneratorService) {}

  async generateBookingToken(params: BookingTokenParams, transaction?: any): Promise<TokenResult> {
    const { clinicId, doctorId, doctorName, date, sessionIndex, slotIndex } = params;
    return this.tokenGenerator.generateToken(
      clinicId, 
      doctorId, 
      doctorName, 
      date, 
      'A', 
      sessionIndex, 
      'advanced', 
      transaction,
      0, // totalSessionSlots
      false, // isPriority
      slotIndex
    );
  }

  /**
   * Advanced mode: token already assigned at booking. Return null.
   */
  async generateArrivalToken(_params: ArrivalTokenParams): Promise<null> {
    return null;
  }
}
