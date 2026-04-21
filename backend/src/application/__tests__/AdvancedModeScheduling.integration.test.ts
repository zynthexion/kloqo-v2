import { InMemoryAppointmentRepository } from '../../infrastructure/mocks/InMemoryAppointmentRepository';
import { QueueBubblingService } from '../../domain/services/QueueBubblingService';
import { TokenGeneratorService } from '../../domain/services/token/TokenGeneratorService';
import { CreateWalkInAppointmentUseCase } from '../CreateWalkInAppointmentUseCase';
import { BookAdvancedAppointmentUseCase } from '../BookAdvancedAppointmentUseCase';
import { ManagePatientUseCase } from '../ManagePatientUseCase';
import { BookingSessionEngine } from '../../domain/services/BookingSessionEngine';
import { SlotCalculator } from '../../domain/services/SlotCalculator';
import { format, parse, addMinutes } from 'date-fns';

describe('Advanced Mode Scheduling (The Buffer) Integration Suite', () => {
  let appointmentRepo: InMemoryAppointmentRepository;
  let bubblingService: QueueBubblingService;
  let tokenGenerator: TokenGeneratorService;
  let createWalkInUseCase: CreateWalkInAppointmentUseCase;
  let bookAdvancedUseCase: BookAdvancedAppointmentUseCase;

  const clinicId = 'clinic-adv';
  const doctorId = 'doc-adv';
  const doctorName = 'Dr. Advanced';
  const dateStr = '22 April 2026';
  const firestoreDate = '22 April 2026';

  const mockDoctor = {
    id: doctorId,
    name: doctorName,
    tokenDistribution: 'advanced',
    averageConsultingTime: 10,
    availabilitySlots: [
      { day: 'Wednesday', timeSlots: [{ from: '09:00', to: '12:20' }] } // 20 slots of 10 mins
    ],
    gracePeriodMinutes: 15
  };

  const mockClinic = {
    id: clinicId,
    tokenDistribution: 'advanced',
    walkInReserveRatio: 0.15 // 15% Buffer
  };

  const mockPatientRepo = {
    findById: jest.fn().mockImplementation((id) => Promise.resolve({ id, name: 'Test Patient' })),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  } as any;

  const mockManagePatientUseCase = {
    execute: jest.fn().mockResolvedValue('patient-adv-1')
  };

  beforeEach(() => {
    appointmentRepo = new InMemoryAppointmentRepository();

    const doctorRepo = {
      findById: jest.fn().mockResolvedValue(mockDoctor),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    const clinicRepo = {
      findById: jest.fn().mockResolvedValue(mockClinic),
      save: jest.fn()
    } as any;

    bubblingService = new QueueBubblingService(appointmentRepo, doctorRepo);
    tokenGenerator = new TokenGeneratorService(appointmentRepo);

    const mockManagePatientUseCase = {
      execute: jest.fn().mockResolvedValue('patient-adv-1')
    };

    createWalkInUseCase = new CreateWalkInAppointmentUseCase(
      appointmentRepo,
      doctorRepo,
      clinicRepo,
      mockManagePatientUseCase as any,
      tokenGenerator
    );

    bookAdvancedUseCase = new BookAdvancedAppointmentUseCase(
      appointmentRepo,
      doctorRepo,
      mockPatientRepo,
      clinicRepo,
      mockManagePatientUseCase as any,
      tokenGenerator
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
   * 📍 Test 1: Smart Bubble Gap Filling
   * Cancelled slot at Index 1 should be filled by a new walk-in.
   */
  test('📍 Test 1: Smart Bubble Gap Filling', async () => {
    const a1 = createAToken(0, '09:00');
    const a2 = { ...createAToken(1, '09:10'), status: 'Cancelled' as const };
    const a3 = createAToken(2, '09:20');
    appointmentRepo.setAppointments([a1, a2, a3]);

    jest.useFakeTimers().setSystemTime(new Date('2026-04-22T08:55:00'));

    const walkIn = await createWalkInUseCase.execute({
      clinicId, doctorId, patientName: 'John GapFiller', place: 'Kochi', sex: 'Male', date: dateStr
    });

    expect(walkIn.slotIndex).toBe(1);
    expect(walkIn.tokenNumber).toBe('W-101');
  });

  /**
   * 📍 Test 2: Physical Buffer Placement
   * Dense session (slots 0-16 full). Walk-in should hit Slot 17 (15% Buffer starts at indexing 17 for 20 slots).
   */
  test('📍 Test 2: Physical Buffer Placement', async () => {
    // Fill 17 slots (0-16)
    const denseApts = Array.from({ length: 17 }, (_, i) => createAToken(i, format(addMinutes(new Date('2026-04-22T09:00:00'), i*10), 'HH:mm')));
    appointmentRepo.setAppointments(denseApts);

    jest.useFakeTimers().setSystemTime(new Date('2026-04-22T08:50:00'));

    const walkIn = await createWalkInUseCase.execute({
      clinicId, doctorId, patientName: 'Buffer Patient', place: 'Kochi', sex: 'Male', date: dateStr
    });

    // 20 * 0.85 = 17. So slots 0-16 are regular, 17, 18, 19 are buffer.
    expect(walkIn.slotIndex).toBe(17);
  });

  /**
   * 📍 Test 3: Capacity Rejection (100%)
   */
  test('📍 Test 3: Capacity Rejection (100%)', async () => {
    // Fill all 20 slots
    const fullApts = Array.from({ length: 20 }, (_, i) => createAToken(i, '09:00'));
    appointmentRepo.setAppointments(fullApts);

    jest.useFakeTimers().setSystemTime(new Date('2026-04-22T09:00:00'));

    await expect(createWalkInUseCase.execute({
      clinicId, doctorId, patientName: 'Fail', place: 'X', sex: 'Male', date: dateStr
    })).rejects.toThrow('No walk-in slots available');
  });

  /**
   * 📍 Test 4: Force Book (Overtime Valve)
   */
  test('📍 Test 4: Force Book (Overtime Valve)', async () => {
    const fullApts = Array.from({ length: 20 }, (_, i) => createAToken(i, '09:00'));
    appointmentRepo.setAppointments(fullApts);

    jest.useFakeTimers().setSystemTime(new Date('2026-04-22T09:00:00'));

    const overtimeW = await createWalkInUseCase.execute({
      clinicId, doctorId, patientName: 'Emergency', place: 'X', sex: 'Male', date: dateStr, isForceBooked: true
    });

    expect(overtimeW.slotIndex).toBe(20); // 1st Overtime slot
    expect(overtimeW.tokenNumber).toBe('W-101');
  });

  /**
   * 📍 Test 5: Priority Triage Injection (PW-001)
   */
  test('📍 Test 5: Priority Triage Injection (PW-001)', async () => {
    const a1 = createAToken(0, '09:00');
    appointmentRepo.setAppointments([a1]);

    jest.useFakeTimers().setSystemTime(new Date('2026-04-22T09:00:00'));

    const pw1 = await createWalkInUseCase.execute({
      clinicId, doctorId, patientName: 'Emergency', place: 'X', sex: 'Male', date: dateStr, isPriority: true
    });

    expect(pw1.slotIndex).toBe(1); // Immediate next gap
    expect(pw1.tokenNumber).toBe('PW-001');
    expect(pw1.isPriority).toBe(true);

    const pw2 = await createWalkInUseCase.execute({
      clinicId, doctorId, patientName: 'Emergency 2', place: 'X', sex: 'Male', date: dateStr, isPriority: true
    });
    expect(pw2.tokenNumber).toBe('PW-002'); // Independent sequence
  });

  /**
   * 📍 Test 6: Unified Token Formatting
   */
  test('📍 Test 6: Unified Token Formatting', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-22T09:00:00'));

    const walkIn = await createWalkInUseCase.execute({ 
      clinicId, doctorId, patientName: 'W', place: 'X', sex: 'Male', date: dateStr 
    });
    const priority = await createWalkInUseCase.execute({ 
      clinicId, doctorId, patientName: 'P', place: 'X', sex: 'Male', date: dateStr, isPriority: true 
    });
    
    expect(walkIn.tokenNumber).toMatch(/W-\d{3}/);
    expect(priority.tokenNumber).toMatch(/PW-\d{3}/);
    expect(createAToken(0, '09:00').tokenNumber).toMatch(/A-\d{3}/);
  });

  /**
   * 📍 Test 7: The 85% Online Booking Firewall
   */
  test('📍 Test 7: The 85% Online Booking Firewall', async () => {
    // Fill 17 slots (exactly 85%)
    const denseApts = Array.from({ length: 17 }, (_, i) => createAToken(i, '09:00'));
    appointmentRepo.setAppointments(denseApts);

    // Try to book slot 17 (which is in the 15% buffer)
    await expect(bookAdvancedUseCase.execute({
      clinicId, doctorId, date: dateStr, sessionIndex: 0, slotIndex: 17, slotTime: '11:50'
    })).rejects.toThrow(); // Should be blocked by Buffer Slot Guard
  });

  /**
   * 📍 Test 8: The "Long-Jump" Retrospective Bubble
   */
  test('📍 Test 8: The "Long-Jump" Retrospective Bubble', async () => {
    const a1 = createAToken(0, '09:00');
    const a2 = createAToken(1, '09:10'); // This will be vacated
    appointmentRepo.setAppointments([a1, a2]);

    // Manually add a walk-in at the end (buffer/tail)
    const wTail = {
      ...createAToken(18, '12:00'),
      id: 'apt-w-tail',
      tokenNumber: 'W-101',
      bookedVia: 'Walk-in' as const
    };
    appointmentRepo.setAppointments([a1, a2, wTail]);

    // Vacate a2
    await appointmentRepo.update(a2.id, { status: 'Skipped' });

    // Action: Vacuum sweep
    await bubblingService.reoptimize({
      clinicId, doctorId, date: firestoreDate, sessionIndex: 0
    });

    const bubbledW = await appointmentRepo.findById(wTail.id);
    expect(bubbledW?.slotIndex).toBe(1); // Jumped from 18 to 1!
  });

  /**
   * 📍 Test 9: Organic Front-Filling
   */
  test('📍 Test 9: Organic Front-Filling', async () => {
    // Session is empty at 09:00 AM
    appointmentRepo.setAppointments([]);

    jest.useFakeTimers().setSystemTime(new Date('2026-04-22T08:50:00'));

    const w1 = await createWalkInUseCase.execute({ clinicId, doctorId, patientName: 'W1', place: 'X', sex: 'Male', date: dateStr });
    const w2 = await createWalkInUseCase.execute({ clinicId, doctorId, patientName: 'W2', place: 'X', sex: 'Male', date: dateStr });

    expect(w1.slotIndex).toBe(0); // 09:00 AM
    expect(w2.slotIndex).toBe(1); // 09:10 AM
    // Not pushed to buffer because front gaps were available
  });

  afterEach(() => {
    jest.useRealTimers();
  });
});
