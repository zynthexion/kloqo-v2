import { InMemoryAppointmentRepository } from '../../infrastructure/mocks/InMemoryAppointmentRepository';
import { QueueBubblingService } from '../../domain/services/QueueBubblingService';
import { ProcessGracePeriodsUseCase } from '../ProcessGracePeriodsUseCase';
import { Appointment, Doctor, Clinic } from '../../../../packages/shared/src/index';

describe('Doctor-Aware Grace Periods (Safety Valve & Pulse Calculation)', () => {
  let appointmentRepo: InMemoryAppointmentRepository;
  let doctorRepo: any; // Type as any for mocks
  let clinicRepo: any;
  let bubblingService: QueueBubblingService;
  let useCase: ProcessGracePeriodsUseCase;

  const CLINIC_ID = 'clinic_1';
  const DOCTOR_ID = 'doctor_1';
  const DATE = '21 April 2026';

  beforeEach(async () => {
    appointmentRepo = new InMemoryAppointmentRepository();
    
    // Inline Mocks
    const mockClinic = {
      id: CLINIC_ID,
      name: 'Test Clinic',
      gracePeriodMinutes: 10, // Default 10 mins
    };

    const mockDoctor = {
      id: DOCTOR_ID,
      name: 'Dr. Delay',
      consultationStatus: 'Out',
      averageConsultingTime: 15,
      availabilitySlots: [{
        day: 'Tuesday',
        timeSlots: [{ from: '10:00', to: '13:00' }]
      }]
    };

    doctorRepo = {
      findById: jest.fn().mockResolvedValue(mockDoctor),
      update: jest.fn().mockImplementation((id, data) => {
        Object.assign(mockDoctor, data);
        return Promise.resolve(mockDoctor);
      }),
      save: jest.fn(),
      delete: jest.fn(),
      findByClinicId: jest.fn().mockResolvedValue([mockDoctor])
    } as any;

    clinicRepo = {
      findById: jest.fn().mockResolvedValue(mockClinic),
      save: jest.fn()
    } as any;

    bubblingService = new QueueBubblingService(appointmentRepo, doctorRepo);
    useCase = new ProcessGracePeriodsUseCase(appointmentRepo, clinicRepo, doctorRepo, bubblingService);

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-21T10:00:00')); // 10:00 AM (Tuesday)
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * SCENARIO 1: Late Start (Doctor is 'Out')
   * Doctor scheduled for 10:00. Time is 10:15.
   * Grace period is 10 mins.
   * Without Safety Valve: Patient would be skipped at 10:10.
   * With Safety Valve: Patient is safe because doctor is 'Out'.
   */
  it('should NOT skip patient if the doctor has not arrived (status Out)', async () => {
    await appointmentRepo.save({
      id: 'apt_1',
      clinicId: CLINIC_ID,
      doctorId: DOCTOR_ID,
      date: DATE,
      time: '10:00',
      status: 'Confirmed',
      sessionIndex: 0,
      tokenNumber: 'A-001'
    } as Appointment);

    // Fast forward to 10:15 AM
    jest.setSystemTime(new Date('2026-04-21T10:15:00'));

    const result = await useCase.execute(CLINIC_ID);
    
    expect(result.skippedAppointmentIds).toHaveLength(0);
    const apt = await appointmentRepo.findById('apt_1');
    expect(apt?.status).toBe('Confirmed');
  });

  /**
   * SCENARIO 2: Consultation Drag (Doctor is 'In' but delayed)
   * 10:00 AM patient is in consultation since 10:00 AM.
   * It is now 10:25 AM (25 mins elapsed, 10 mins drag since avg is 15).
   * 10:15 AM patient (apt_2) would normally be skipped at 10:25 (10:15 + 10 grace).
   * With Pulse: Deadline = 10:15 + 10 delay + 10 grace = 10:35.
   * Result: apt_2 should be safe at 10:25.
   */
  it('should shift skip deadline dynamically based on consultation drag', async () => {
    // 1. Doctor clocks 'In'
    await doctorRepo.update(DOCTOR_ID, { consultationStatus: 'In' });

    // 2. 10:00 AM Patient is in consultation
    await appointmentRepo.save({
      id: 'apt_active',
      doctorId: DOCTOR_ID,
      clinicId: CLINIC_ID,
      date: DATE,
      time: '10:00',
      status: 'InConsultation',
      updatedAt: new Date('2026-04-21T10:00:00'),
      sessionIndex: 0
    } as Appointment);

    // 3. 10:15 AM Patient is waiting
    await appointmentRepo.save({
      id: 'apt_waiting',
      doctorId: DOCTOR_ID,
      clinicId: CLINIC_ID,
      date: DATE,
      time: '10:15',
      status: 'Confirmed',
      sessionIndex: 0,
      tokenNumber: 'A-002'
    } as Appointment);

    // Fast forward to 10:25 AM
    jest.setSystemTime(new Date('2026-04-21T10:25:00'));

    const result = await useCase.execute(CLINIC_ID);
    
    // Pulse calculation should protect 'apt_waiting'
    expect(result.skippedAppointmentIds).toHaveLength(0);

    // 4. Doctor completes the long consultation
    await appointmentRepo.update('apt_active', { status: 'Completed', completedAt: new Date('2026-04-21T10:25:00') });
    
    // Once completed, delay falls to 0. 
    // apt_waiting (10:15) + 10 grace = 10:25.
    // It should now be skipped.
    const result2 = await useCase.execute(CLINIC_ID);
    expect(result2.skippedAppointmentIds).toContain('apt_waiting');
  });

  /**
   * SCENARIO 3: Priority Exemption (PW Tokens)
   * A-Tokens are late -> skipped.
   * PW-Tokens are late -> safe.
   */
  it('should NEVER auto-skip priority walk-ins (PW- tokens)', async () => {
    await doctorRepo.update(DOCTOR_ID, { consultationStatus: 'In' });

    await appointmentRepo.save({
      id: 'apt_pw',
      doctorId: DOCTOR_ID,
      clinicId: CLINIC_ID,
      date: DATE,
      time: '10:00',
      status: 'Confirmed',
      tokenNumber: 'PW-001',
      sessionIndex: 0
    } as Appointment);

    // Fast forward 5 hours (Doctor is long gone)
    jest.setSystemTime(new Date('2026-04-21T15:00:00'));

    const result = await useCase.execute(CLINIC_ID);
    expect(result.skippedAppointmentIds).not.toContain('apt_pw');
    
    const apt = await appointmentRepo.findById('apt_pw');
    expect(apt?.status).toBe('Confirmed');
  });

  /**
   * SCENARIO 4: Late Start Recovery
   * Doctor arrives at 10:20 (for 10:00 session).
   * 10:00 patient (apt_1) should have a 20 min delay.
   * Should be safe until 10:00 + 20 delay + 10 grace = 10:30.
   */
  it('should handle late start recovery accurately', async () => {
    await appointmentRepo.save({
      id: 'apt_1',
      doctorId: DOCTOR_ID,
      clinicId: CLINIC_ID,
      date: DATE,
      time: '10:00',
      status: 'Confirmed',
      sessionIndex: 0,
      tokenNumber: 'A-001'
    } as Appointment);

    // It is 10:25 AM. Doctor just clocked IN.
    await doctorRepo.update(DOCTOR_ID, { consultationStatus: 'In' });
    jest.setSystemTime(new Date('2026-04-21T10:25:00'));

    // Note: No one has been completed yet.
    const result = await useCase.execute(CLINIC_ID);
    
    // Status in logic implies if doctor is In, and NO ONE completed yet, 
    // delay is still now - sessionStartTime for the first batch.
    expect(result.skippedAppointmentIds).toHaveLength(0);
  });
});
