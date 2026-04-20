import { Clinic, Doctor, Appointment, QueueState, compareAppointments, compareAppointmentsClassic } from '../../../packages/shared/src/index';
import { IAppointmentRepository, IDoctorRepository, IClinicRepository } from '../domain/repositories';
import { ClinicNotApprovedError, OnboardingIncompleteError } from '../domain/errors';

export interface NurseDashboardData {
  clinic: Clinic;
  doctors: Doctor[];
  appointments: Appointment[];
  queues: Record<string, QueueState>;
  currentTime: string;
}

import { SyncClinicStatusesUseCase } from './SyncClinicStatusesUseCase';

export class GetNurseDashboardUseCase {
  constructor(
    private clinicRepo: IClinicRepository,
    private doctorRepo: IDoctorRepository,
    private appointmentRepo: IAppointmentRepository,
    private syncStatusUseCase: SyncClinicStatusesUseCase
  ) {}

  async execute(clinicId: string, date: string): Promise<NurseDashboardData> {
    // Sync statuses first to ensure fresh data
    await this.syncStatusUseCase.execute(clinicId);

    const [clinic, doctors, appointments] = await Promise.all([
      this.clinicRepo.findById(clinicId),
      this.doctorRepo.findByClinicId(clinicId),
      this.appointmentRepo.findByClinicAndDate(clinicId, date)
    ]);

    if (!clinic) {
      throw new Error('Clinic not found');
    }

    // 🔒 SECURITY: BKP-01 Staff Blinding
    // Hide 'Pending' appointments that haven't been paid for yet.
    // ANALYTICS GUARDRAIL: Also strip system-generated ghost break-blocker records
    // (isSystemBlocker === true). They are inserted by ScheduleBreakUseCase to
    // hard-block break slots — they must never appear in queues or counts.
    const filteredAppointments = (appointments || []).filter(apt => {
      if (apt.isSystemBlocker) return false;
      const isUnpaidPending = apt.status === 'Pending' && (apt.paymentStatus === 'Unpaid' || !apt.paymentStatus);
      
      // Allow Advanced Bookings even if unpaid/pending so staff can see the full day's schedule
      if (apt.bookedVia === 'Advanced Booking') return true;
      
      return !isUnpaidPending;
    });

    if (clinic.registrationStatus !== 'Approved') {
      throw new ClinicNotApprovedError();
    }

    if (clinic.onboardingStatus !== 'Completed') {
      throw new OnboardingIncompleteError();
    }

    const doctorsList = Array.isArray(doctors) ? doctors : doctors.data;
    // Compute queues for each doctor
    const queues: Record<string, QueueState> = {};

    doctorsList.forEach(doctor => {
      const doctorAppointments = filteredAppointments.filter(apt => apt.doctorName === doctor.name);
      const docDistribution = doctor.tokenDistribution || clinic.tokenDistribution || 'advanced';
      
      const arrivedQueue = doctorAppointments
        .filter(apt => apt.status === 'Confirmed' && !apt.isPriority)
        .sort(docDistribution === 'advanced' ? compareAppointments : compareAppointmentsClassic);

      const priorityQueue = doctorAppointments
        .filter(apt => apt.status === 'Confirmed' && apt.isPriority)
        .sort((a, b) => {
          const pA = (a.priorityAt as any)?.seconds || 0;
          const pB = (b.priorityAt as any)?.seconds || 0;
          return pA - pB;
        });

      const bufferQueue = arrivedQueue.filter(apt => apt.isInBuffer);
      
      const skippedQueue = doctorAppointments
        .filter(apt => apt.status === 'Skipped')
        .sort(compareAppointments);

      let currentConsultation: Appointment | null = null;
      if (priorityQueue.length > 0) {
        currentConsultation = priorityQueue[0];
      } else if (bufferQueue.length > 0) {
        currentConsultation = bufferQueue[0];
      }

      queues[doctor.id] = {
        arrivedQueue,
        bufferQueue,
        priorityQueue,
        skippedQueue,
        currentConsultation,
        consultationCount: 0, // Should be fetched from a separate collection if needed
        nextBreakDuration: null // TBD
      };
    });

    return {
      clinic,
      doctors: doctorsList,
      appointments: filteredAppointments,
      queues,
      currentTime: new Date().toISOString()
    };
  }
}
