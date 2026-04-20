import { InMemoryAppointmentRepository } from '../../infrastructure/mocks/InMemoryAppointmentRepository';
import { WalkInPlacementService } from '../../domain/services/WalkInPlacementService';
import { QueueBubblingService } from '../../domain/services/QueueBubblingService';
import { TokenGeneratorService } from '../../domain/services/token/TokenGeneratorService';
import { CreateWalkInAppointmentUseCase } from '../CreateWalkInAppointmentUseCase';
import { ProcessGracePeriodsUseCase } from '../ProcessGracePeriodsUseCase';
import { SlotCalculator } from '../../domain/services/SlotCalculator';
import { format, parse, addMinutes } from 'date-fns';

describe('Classic Mode Scheduling (The Zipper) Integration Suite', () => {
  let appointmentRepo: InMemoryAppointmentRepository;
  let bubblingService: QueueBubblingService;
  let tokenGenerator: TokenGeneratorService;
  let createWalkInUseCase: CreateWalkInAppointmentUseCase;
  let gracePeriodUseCase: ProcessGracePeriodsUseCase;

  const clinicId = 'clinic-123';
  const doctorId = 'doc-456';
  const doctorName = 'Dr. Smith';
  const dateStr = '20 April 2026';
  const firestoreDate = '20 April 2026';

  const mockDoctor = {
    id: doctorId,
    name: doctorName,
    tokenDistribution: 'classic',
    averageConsultingTime: 5,
    availabilitySlots: [
      { day: 'Monday', timeSlots: [{ from: '09:00', to: '11:00' }] },
      { day: 'Tuesday', timeSlots: [{ from: '09:00', to: '11:00' }] },
      { day: 'Wednesday', timeSlots: [{ from: '09:00', to: '11:00' }] },
      { day: 'Thursday', timeSlots: [{ from: '09:00', to: '11:00' }] },
      { day: 'Friday', timeSlots: [{ from: '09:00', to: '11:00' }] },
      { day: 'Saturday', timeSlots: [{ from: '09:00', to: '11:00' }] },
      { day: 'Sunday', timeSlots: [{ from: '09:00', to: '11:00' }] }
    ],
    gracePeriodMinutes: 10
  };

  const mockClinic = {
    id: clinicId,
    walkInTokenAllotment: 3, // 1:3 Zipper
    gracePeriodMinutes: 15,
    tokenDistribution: 'classic'
  };

  const mockManagePatientUseCase = {
    execute: jest.fn().mockResolvedValue('patient-999')
  };

  beforeEach(() => {
    appointmentRepo = new InMemoryAppointmentRepository();
    bubblingService = new QueueBubblingService(appointmentRepo);
    tokenGenerator = new TokenGeneratorService(appointmentRepo);
    
    const doctorRepo = {
      findById: jest.fn().mockResolvedValue(mockDoctor),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      findByIds: jest.fn(),
      findByName: jest.fn(),
      findByClinicId: jest.fn(),
      findByEmail: jest.fn(),
      findByUserId: jest.fn()
    } as any;

    const clinicRepo = {
      findById: jest.fn().mockResolvedValue(mockClinic),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      findByIds: jest.fn(),
      updateLastSyncAt: jest.fn(),
      countActive: jest.fn(),
      incrementDoctorCount: jest.fn(),
      upgradeSubscriptionWithTransaction: jest.fn()
    } as any;

    createWalkInUseCase = new CreateWalkInAppointmentUseCase(
      appointmentRepo,
      doctorRepo,
      clinicRepo,
      mockManagePatientUseCase as any,
      tokenGenerator
    );

    gracePeriodUseCase = new ProcessGracePeriodsUseCase(
      appointmentRepo,
      clinicRepo,
      doctorRepo,
      bubblingService
    );
  });

  // --- Helpers ---
  const createAToken = (slotIndex: number, time: string) => ({
    id: `apt-a-${slotIndex}`,
    patientId: `p-${slotIndex}`,
    patientName: `Patient A-${slotIndex + 1}`,
    doctorId,
    doctorName,
    clinicId,
    date: firestoreDate,
    time,
    status: 'Confirmed' as const,
    tokenNumber: `A-${String(slotIndex + 1).padStart(3, '0')}`,
    bookedVia: 'Advanced Booking' as const,
    slotIndex,
    sessionIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  /**
   * Scenario 1: The Perfect Zipper
   * 1:3 Spacing. A-001, A-002, A-003 booked.
   * Walk-in arrives. Expected: Slot 4 (Index 3). Token: W-104 (Offset 100+30+1)
   * Wait, for totalSlots=30, offset is 100. W-Tokens start at 101.
   */
  test('📍 Scenario 1: The Perfect Zipper (Standard Load)', async () => {
    // 1. Setup: 3 A-tokens at 9:00, 9:05, 9:10
    const a1 = createAToken(0, '09:00');
    const a2 = createAToken(1, '09:05');
    const a3 = createAToken(2, '09:10');
    appointmentRepo.setAppointments([a1, a2, a3]);

    // 2. Action: Walk-in arrives at 8:50 AM
    // We mock "now" to 8:50 AM
    const now = new Date('2026-04-20T08:50:00');
    jest.useFakeTimers().setSystemTime(now);

    const walkIn = await createWalkInUseCase.execute({
      clinicId,
      doctorId,
      patientName: 'John WalkIn',
      place: 'Kochi',
      sex: 'Male',
      date: dateStr
    });

    // 3. Assertions
    expect(walkIn.slotIndex).toBe(3); // 4th slot
    expect(walkIn.time).toBe('09:15');
    expect(walkIn.tokenNumber).toBe('W-101'); // First W-token in session
    
    const dbAppts = await appointmentRepo.findByDoctorAndDate(doctorId, firestoreDate);
    expect(dbAppts).toHaveLength(4);
  });

  /**
   * Scenario 2: The Late Patient & The Bubble
   * A-002 (9:05) is late. W-101 (9:15) is waiting. 
   * Grace Period runs at 9:16. 
   * A-002 becomes Skipped. W-101 bubbles to 9:05.
   */
  test('📍 Scenario 2: The Late Patient & The Bubble (Self-Healing Queue)', async () => {
    // 1. Setup: A-001(9:00) is COMPLETED, A-002(9:05) and A-003(9:10) are late.
    const a1 = { ...createAToken(0, '09:00'), status: 'Completed' as const };
    const a2 = createAToken(1, '09:05');
    const a3 = createAToken(2, '09:10');
    
    // Add walk-in manually for setup
    const w1 = {
      ...createAToken(3, '09:15'),
      id: 'apt-w-101',
      tokenNumber: 'W-101',
      bookedVia: 'Walk-in' as const
    };
    appointmentRepo.setAppointments([a1, a2, a3, w1]);

    // 2. Action: Run Grace Period sweep at 9:16 AM
    // a2 (deadline 9:15) is late. a3 (deadline 9:20) is safe.
    const now = new Date('2026-04-20T09:16:00');
    jest.useFakeTimers().setSystemTime(now);

    await gracePeriodUseCase.execute(clinicId);

    // 3. Assertions
    const skippedA2 = await appointmentRepo.findById(a2.id);
    expect(skippedA2?.status).toBe('Skipped');

    const bubbledW1 = await appointmentRepo.findById(w1.id);
    expect(bubbledW1?.slotIndex).toBe(1); // Moved to 9:05 slot
    expect(bubbledW1?.tokenNumber).toBe('W-101'); // Token stays same
  });

  /**
   * Scenario 3: The Empty Start
   * A-004(10:15), A-005(10:20) booked.
   * 10:00, 10:05, 10:10 are empty.
   * 3 Walk-ins arrive. They should fill the start.
   */
  test('📍 Scenario 3: The Empty Start (Organic Gap Filling)', async () => {
    // 1. Setup: Advanced slots at 10:15 (slot 15) and 10:20 (slot 16)
    // 0-14 are empty.
    const a4 = createAToken(15, '10:15');
    const a5 = createAToken(16, '10:20');
    appointmentRepo.setAppointments([a4, a5]);

    const now = new Date('2026-04-20T09:55:00');
    jest.useFakeTimers().setSystemTime(now);

    // 2. Action: 3 Walk-ins arrive
    const w1 = await createWalkInUseCase.execute({ clinicId, doctorId, patientName: 'W1', place: 'X', sex: 'Male', date: dateStr });
    const w2 = await createWalkInUseCase.execute({ clinicId, doctorId, patientName: 'W2', place: 'X', sex: 'Male', date: dateStr });
    const w3 = await createWalkInUseCase.execute({ clinicId, doctorId, patientName: 'W3', place: 'X', sex: 'Male', date: dateStr });

    // 3. Assertions: They fill the organic gaps at 10:00, 10:05, 10:10
    // Slot 12 is 10:00 AM (09:00 + 12 * 5 mins)
    expect(w1.slotIndex).toBe(12); // 10:00
    expect(w2.slotIndex).toBe(13); // 10:05
    expect(w3.slotIndex).toBe(14); // 10:10
    expect(w1.tokenNumber).toBe('W-101');
    expect(w2.tokenNumber).toBe('W-102');
    expect(w3.tokenNumber).toBe('W-103');
  });

  /**
   * Scenario 4: The Triage Override
   * Dense session. Priority walk-in should take next gap.
   */
  test('📍 Scenario 4: The Triage Override (PW-Token Injection)', async () => {
    // 1. Setup: A-001(0), A-002(1). Next regular walk-in would be (5) due to 1:3 spacing
    const a1 = createAToken(0, '09:00');
    const a2 = createAToken(1, '09:05');
    appointmentRepo.setAppointments([a1, a2]);

    const now = new Date('2026-04-20T09:00:00');
    jest.useFakeTimers().setSystemTime(now);

    // 2. Action: Priority Walk-in arrives
    const pw1 = await createWalkInUseCase.execute({
      clinicId,
      doctorId,
      patientName: 'Priority P',
      place: 'Y',
      sex: 'Female',
      date: dateStr,
      isPriority: true
    });

    // 3. Assertions: PW-001 takes slot 2 (Immediate next gap)
    expect(pw1.slotIndex).toBe(2);
    expect(pw1.tokenNumber).toBe('PW-001');
    expect(pw1.isPriority).toBe(true);
  });

  /**
   * Scenario 5: The Capacity Hard-Stop & Overtime
   * sessionSlots length = 30. Booked count = 30.
   * Force Book should create slot 30.
   */
  test('📍 Scenario 5: The Capacity Hard-Stop & Overtime', async () => {
    // 1. Setup: Fill all 24 slots (0-23)
    // 09:00 to 11:00 @ 5 mins = 24 slots
    const fullAppts = Array.from({ length: 24 }, (_, i) => createAToken(i, '09:00'));
    appointmentRepo.setAppointments(fullAppts);
    
    // Manually set booked count for testing by incrementing 24 times
    for (let i = 0; i < 24; i++) {
      await appointmentRepo.updateBookedCount(clinicId, doctorId, firestoreDate, 0, 1, {} as any);
    }

    const now = new Date('2026-04-20T09:00:00');
    jest.useFakeTimers().setSystemTime(now);

    // 2. Action A: Regular Walk-in fails
    await expect(createWalkInUseCase.execute({
      clinicId,
      doctorId,
      patientName: 'Should Fail',
      place: 'Z',
      sex: 'Male',
      date: dateStr
    })).rejects.toThrow('No walk-in slots available');

    // 3. Action B: Force Book succeeds
    const overtimeW = await createWalkInUseCase.execute({
      clinicId,
      doctorId,
      patientName: 'Force Book Patient',
      place: 'Z',
      sex: 'Male',
      date: dateStr,
      isForceBooked: true
    });

    // 4. Assertions: Assigned to slot 24 (Overtime: sessionSlots.length)
    expect(overtimeW.slotIndex).toBe(24);
    expect(overtimeW.tokenNumber).toBe('W-101'); 
  });

  afterEach(() => {
    jest.useRealTimers();
  });
});
