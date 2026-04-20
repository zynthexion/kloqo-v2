import { InMemoryAppointmentRepository } from '../../infrastructure/mocks/InMemoryAppointmentRepository';
import { WalkInPlacementService } from '../../domain/services/WalkInPlacementService';
import { QueueBubblingService } from '../../domain/services/QueueBubblingService';
import { TokenGeneratorService } from '../../domain/services/token/TokenGeneratorService';
import { CreateWalkInAppointmentUseCase } from '../CreateWalkInAppointmentUseCase';
import { UpdateAppointmentStatusUseCase } from '../UpdateAppointmentStatusUseCase';
import { ProcessGracePeriodsUseCase } from '../ProcessGracePeriodsUseCase';
import { sseService } from '../../domain/services/SSEService';
import { SlotsFullError } from '../../domain/errors';

describe('Classic Mode Chaos Suite (Resilience Testing)', () => {
  let appointmentRepo: InMemoryAppointmentRepository;
  let bubblingService: QueueBubblingService;
  let tokenGenerator: TokenGeneratorService;
  let createWalkInUseCase: CreateWalkInAppointmentUseCase;
  let updateStatusUseCase: UpdateAppointmentStatusUseCase;
  let gracePeriodUseCase: ProcessGracePeriodsUseCase;

  const clinicId = 'clinic-chaos';
  const doctorId = 'doc-chaos';
  const doctorName = 'Dr. Chaos';
  const dateStr = '21 April 2026';
  const firestoreDate = '21 April 2026';

  const mockDoctor = {
    id: doctorId,
    name: doctorName,
    tokenDistribution: 'classic',
    averageConsultingTime: 5,
    availabilitySlots: [
      { day: 'Tuesday', timeSlots: [{ from: '09:00', to: '11:00' }] }
    ],
    gracePeriodMinutes: 10
  };

  const mockClinic = {
    id: clinicId,
    walkInTokenAllotment: 1, // 1:1 Zipper for chaos
    gracePeriodMinutes: 10,
    tokenDistribution: 'classic'
  };

  const mockManagePatientUseCase = {
    execute: jest.fn().mockImplementation(({ name }) => Promise.resolve(`p-${name}`))
  };

  const mockCounterRepo = {
    increment: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(0)
  };

  const mockNotificationService = {
    notifyNextPatientsWhenCompleted: jest.fn().mockResolvedValue(undefined),
    sendAppointmentCancelledNotification: jest.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    appointmentRepo = new InMemoryAppointmentRepository();
    bubblingService = new QueueBubblingService(appointmentRepo);
    tokenGenerator = new TokenGeneratorService(appointmentRepo);
    
    const doctorRepo = {
      findById: jest.fn().mockResolvedValue(mockDoctor),
    } as any;

    const clinicRepo = {
      findById: jest.fn().mockResolvedValue(mockClinic),
    } as any;

    createWalkInUseCase = new CreateWalkInAppointmentUseCase(
      appointmentRepo,
      doctorRepo,
      clinicRepo,
      mockManagePatientUseCase as any,
      tokenGenerator
    );

    updateStatusUseCase = new UpdateAppointmentStatusUseCase(
      appointmentRepo,
      doctorRepo,
      clinicRepo,
      mockNotificationService as any,
      mockCounterRepo as any,
      tokenGenerator,
      bubblingService
    );

    gracePeriodUseCase = new ProcessGracePeriodsUseCase(
      appointmentRepo,
      clinicRepo,
      doctorRepo,
      bubblingService
    );

    jest.spyOn(sseService, 'emit').mockImplementation(() => true);
  });

  const createAToken = (slotIndex: number, time: string) => ({
    id: `apt-a-${slotIndex}`,
    patientId: `p-a-${slotIndex}`,
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
   * 🚨 Chaos Scenario 1: The "Double-Click" Concurrency Race
   */
  test('🚨 Scenario 1: The Double-Click Concurrency Race', async () => {
    // 1. Setup: 23 slots filled. Only 1 slot left (index 23).
    const appts = Array.from({ length: 23 }, (_, i) => createAToken(i, '09:00'));
    appointmentRepo.setAppointments(appts);
    for (let i = 0; i < 23; i++) {
        await appointmentRepo.updateBookedCount(clinicId, doctorId, firestoreDate, 0, 1, {} as any);
    }

    const now = new Date('2026-04-21T08:50:00');
    jest.useFakeTimers().setSystemTime(now);

    // 2. Action: Two simultaneous requests
    const p1Promise = createWalkInUseCase.execute({
      clinicId, doctorId, patientName: 'User A', place: 'X', sex: 'Male', date: dateStr
    });
    const p2Promise = createWalkInUseCase.execute({
      clinicId, doctorId, patientName: 'User B', place: 'X', sex: 'Male', date: dateStr
    });

    const results = await Promise.allSettled([p1Promise, p2Promise]);

    // 3. Assertions
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    
    // Check error type (if implementation uses SlotsFullError)
    const error = (rejected[0] as PromiseRejectedResult).reason;
    expect(error.message).toContain('No walk-in slots available');
  });

  /**
   * 🚨 Chaos Scenario 2: The "Bathroom" Revert Collision
   */
  test('🚨 Scenario 2: The Bathroom Revert Collision (Safe Downgrade)', async () => {
    // 1. Setup: A-002 (slot 1) is SKIPPED. W-101 (slot 3) bubbles into slot 1.
    const a1 = { ...createAToken(0, '09:00'), status: 'Completed' as const };
    const a2 = { ...createAToken(1, '09:05'), status: 'Skipped' as const };
    const a3 = createAToken(2, '09:10');
    
    const w1 = {
      ...createAToken(3, '09:15'),
      id: 'apt-w-101',
      tokenNumber: 'W-101',
      bookedVia: 'Walk-in' as const
    };
    appointmentRepo.setAppointments([a1, a2, a3, w1]);

    // Action: Bubble W-101 into slot 1
    await bubblingService.reoptimize({ sessionIndex: 0, doctorId, clinicId, date: firestoreDate });

    const bubbledW1 = await appointmentRepo.findById(w1.id);
    expect(bubbledW1?.slotIndex).toBe(1);

    // 2. Action: A-002 returns from bathroom and receptionist tries to Confirm him
    const updatedA2 = await updateStatusUseCase.execute({
      appointmentId: a2.id,
      status: 'Confirmed',
      clinicId
    });

    // 3. Assertions
    expect(updatedA2.status).toBe('Confirmed');
    expect(updatedA2.bookedVia).toBe('Walk-in'); // Downgraded!
    expect(updatedA2.slotIndex).not.toBe(1); // Not in original slot
    expect(updatedA2.tokenNumber).toMatch(/^W-/); // Got a new token
    
    // Check that W-101 is still in slot 1
    const recheckedW1 = await appointmentRepo.findById(w1.id);
    expect(recheckedW1?.slotIndex).toBe(1);
  });

  /**
   * 🚨 Chaos Scenario 3: The "Multiple Gap" Vacuum
   */
  test('🚨 Scenario 3: The Multiple Gap Vacuum', async () => {
    // 1. Setup: A1, A2, A3, A4, A5. Gaps at 0, 1, 2. (A, B, C skipped)
    const a1 = { ...createAToken(0, '09:00'), status: 'Confirmed' as const };
    const a2 = { ...createAToken(1, '09:05'), status: 'Confirmed' as const };
    const a3 = { ...createAToken(2, '09:10'), status: 'Confirmed' as const };
    
    const w1 = { ...createAToken(3, '09:15'), id: 'w1', tokenNumber: 'W-101', bookedVia: 'Walk-in' as const };
    const w2 = { ...createAToken(4, '09:20'), id: 'w2', tokenNumber: 'W-102', bookedVia: 'Walk-in' as const };
    const w3 = { ...createAToken(5, '09:25'), id: 'w3', tokenNumber: 'W-103', bookedVia: 'Walk-in' as const };
    
    appointmentRepo.setAppointments([a1, a2, a3, w1, w2, w3]);

    // 2. Action: Mass skip A1, A2, A3 at 9:21 AM (all past 10m grace)
    const now = new Date('2026-04-21T09:21:00');
    jest.useFakeTimers().setSystemTime(now);

    // Execute sweep (it will skip 3 and trigger reoptimize 3 times)
    // Actually, calling reoptimize even once should now vacuum all 3 gaps.
    await gracePeriodUseCase.execute(clinicId);

    // 3. Assertions
    const resW1 = await appointmentRepo.findById('w1');
    const resW2 = await appointmentRepo.findById('w2');
    const resW3 = await appointmentRepo.findById('w3');

    // All should have moved forward to fill the vacuum
    expect(resW1?.slotIndex).toBe(0);
    expect(resW2?.slotIndex).toBe(1);
    expect(resW3?.slotIndex).toBe(2);

    // Verify SSE batched event was emitted
    expect(sseService.emit).toHaveBeenCalledWith('queue_reoptimized', clinicId, expect.objectContaining({
        reslotted: expect.arrayContaining([
            expect.objectContaining({ appointmentId: 'w1', newSlotIndex: 0 }),
            expect.objectContaining({ appointmentId: 'w2', newSlotIndex: 1 }),
            expect.objectContaining({ appointmentId: 'w3', newSlotIndex: 2 })
        ])
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
});
