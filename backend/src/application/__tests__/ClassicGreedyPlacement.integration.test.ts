import { WalkInPlacementService } from '@domain/services/WalkInPlacementService';
import { DailySlot } from '@domain/services/SlotCalculator';
import { Appointment } from '@kloqo/shared';

describe('WalkInPlacementService - Classic Greedy Strategy', () => {
  const mockNow = new Date('2026-04-21T09:00:00Z');
  
  // Create a 10-slot session starting at 09:00 AM
  const sessionSlots: DailySlot[] = Array.from({ length: 10 }).map((_, i) => ({
    index: i,
    time: new Date(mockNow.getTime() + i * 10 * 60000), // 10-min slots
    sessionIndex: 0
  }));

  it('should Front-Fill the first empty slot when session is empty', () => {
    const appointments: Appointment[] = [];
    const result = WalkInPlacementService.findOptimalWalkInSlot(
      sessionSlots,
      appointments,
      new Date(mockNow.getTime() - 1000), // 1 sec before first slot
      'classic',
      4 // N=4 (1 in 5)
    );

    expect(result?.index).toBe(0);
  });

  it('should skip booked A-tokens and take the next greedy gap or zipper', () => {
    const appointments: Partial<Appointment>[] = [
      { id: 'a1', slotIndex: 0, status: 'Confirmed', bookedVia: 'Advanced Booking' },
      { id: 'a2', slotIndex: 1, status: 'Confirmed', bookedVia: 'Advanced Booking' }
    ];

    const result = WalkInPlacementService.findOptimalWalkInSlot(
      sessionSlots,
      appointments as Appointment[],
      new Date(mockNow.getTime() - 1000),
      'classic',
      4
    );

    // Slot 0, 1 are taken. Earliest gap is Slot 2.
    expect(result?.index).toBe(2);
  });

  it('should correctly target the Zipper slot (N=4 -> Slot 4) if gaps 0-3 are FULLY booked', () => {
    const appointments: Partial<Appointment>[] = [
      { id: 'a1', slotIndex: 0, status: 'Confirmed' },
      { id: 'a2', slotIndex: 1, status: 'Confirmed' },
      { id: 'a3', slotIndex: 2, status: 'Confirmed' },
      { id: 'a4', slotIndex: 3, status: 'Confirmed' }
    ];

    const result = WalkInPlacementService.findOptimalWalkInSlot(
      sessionSlots,
      appointments as Appointment[],
      new Date(mockNow.getTime() - 1000),
      'classic',
      4
    );

    // Slots 0-3 are full. Slot 4 is the first available slot (and incidentally the zipper).
    expect(result?.index).toBe(4);
  });

  it('should obey the "now" constraint and never return a past slot', () => {
    const appointments: Appointment[] = [];
    
    // "Now" is at 09:25 AM. Slots 0 (09:00) and 1 (09:10) and 2 (09:20) are past.
    const result = WalkInPlacementService.findOptimalWalkInSlot(
      sessionSlots,
      appointments,
      new Date(mockNow.getTime() + 25 * 60000), 
      'classic',
      4
    );

    // First future slot is Index 3 (09:30).
    expect(result?.index).toBe(3);
  });
});
