/**
 * Token Strategy Interface
 * 
 * Implements the Strategy Pattern for token distribution.
 * Each distribution mode (classic, advanced) has its own implementation.
 * 
 * SOLID: Open/Closed — adding a new distribution mode requires zero changes
 * to existing use cases; just add a new ITokenStrategy implementation.
 */

export interface BookingTokenParams {
  clinicId: string;
  doctorId: string;
  doctorName: string;
  date: string; // 'd MMMM yyyy'
  sessionIndex: number;
}

export interface ArrivalTokenParams {
  clinicId: string;
  doctorId: string;       // needed by repository's generateToken for counter ID
  doctorName: string;
  date: string; // 'd MMMM yyyy'
  sessionIndex: number;
  appointmentId: string;
  existingClassicTokenNumber?: string;
}

export interface TokenResult {
  tokenNumber: string;   // Display token (e.g. "A001", "001")
  numericToken: number;  // Raw counter value for sorting/scheduling
}

export interface ITokenStrategy {
  /**
   * Called at booking time.
   * - Advanced: generates and returns A001/A002 token immediately.
   * - Classic: returns null (token assigned on arrival, not at booking).
   */
  generateBookingToken(params: BookingTokenParams, transaction?: any): Promise<TokenResult | null>;

  /**
   * Called when patient's status changes to 'Confirmed' (patient arrives).
   * - Classic: generates and returns the next sequential arrival number (001, 002...).
   * - Advanced: returns null (token was already assigned at booking).
   */
  generateArrivalToken(params: ArrivalTokenParams): Promise<string | null>;
}
