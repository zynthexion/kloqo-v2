import { Clinic, Doctor, Appointment, QueueState, compareAppointments, compareAppointmentsClassic } from '../../../packages/shared/src/index';
import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IPatientRepository } from '../domain/repositories';
import { ClinicNotApprovedError, OnboardingIncompleteError } from '../domain/errors';

export interface NurseDashboardData {
  clinic: Clinic;
  doctors: Doctor[];
  appointments: Appointment[];
  queues: Record<string, QueueState>;
  currentTime: string;
  totalCount?: number;
  hasMore?: boolean;
}

import { SyncClinicStatusesUseCase } from './SyncClinicStatusesUseCase';

export class GetNurseDashboardUseCase {
  constructor(
    private clinicRepo: IClinicRepository,
    private doctorRepo: IDoctorRepository,
    private appointmentRepo: IAppointmentRepository,
    private syncStatusUseCase: SyncClinicStatusesUseCase,
    private patientRepo?: IPatientRepository
  ) {}

  async execute(clinicId: string, date: string, assignedDoctorIds?: string[], pagination?: { page: number; limit: number }, search?: string): Promise<NurseDashboardData> {
    // Sync statuses first to ensure fresh data
    await this.syncStatusUseCase.execute(clinicId).catch(e => {});

    let appointments: Appointment[] = [];
    let totalCount = 0;
    let hasMore = false;

    if (search) {
      // If searching, we ignore the date and look across all appointments in this clinic
      const res = await this.appointmentRepo.findAll({ 
        clinicId, 
        search, 
        page: pagination?.page || 1, 
        limit: pagination?.limit || 20,
        doctorId: assignedDoctorIds && assignedDoctorIds.length > 0 ? assignedDoctorIds[0] : undefined // For now, handle single doctor context if repository supports it
      });
      if (Array.isArray(res)) {
        appointments = res;
        totalCount = res.length;
        hasMore = false;
      } else {
        appointments = res.data;
        totalCount = res.total;
        hasMore = !!res.hasMore;
      }
    } else if (pagination) {
      const paginatedRes = await this.appointmentRepo.findPaginatedByClinicAndDate(clinicId, date, pagination as any);
      appointments = paginatedRes.data;
      totalCount = paginatedRes.total;
      hasMore = !!paginatedRes.hasMore;
    } else {
      appointments = await this.appointmentRepo.findByClinicAndDate(clinicId, date);
      totalCount = appointments.length;
      hasMore = false;
    }

    const [clinic, doctors] = await Promise.all([
      this.clinicRepo.findById(clinicId),
      this.doctorRepo.findByClinicId(clinicId)
    ]);

    if (!clinic) {
      throw new Error('Clinic not found');
    }

    if (this.patientRepo && appointments && appointments.length > 0) {
      const patientIds = [...new Set(appointments.map(a => a.patientId))];
      const patients = await Promise.all(patientIds.map(id => this.patientRepo!.findById(id)));
      const patientMap = new Map(patients.filter(p => p).map(p => [p!.id, p]));

      for (const apt of appointments) {
        const p = patientMap.get(apt.patientId);
        if (p) {
          if (!apt.age && p.age) apt.age = p.age;
          if (!apt.sex && p.sex) apt.sex = p.sex as any;
          if (!apt.weight && p.weight) apt.weight = p.weight;
          if (!apt.height && p.height) apt.height = p.height;
          if (!apt.communicationPhone && p.communicationPhone) apt.communicationPhone = p.communicationPhone;
          if (!(apt as any).phone && p.phone) (apt as any).phone = p.phone;
        }
      }
    }

    // 🔒 SECURITY: BKP-01 Staff Blinding
    let filteredAppointments = (appointments || []).filter(apt => {
      if (apt.isSystemBlocker) return false;
      const isUnpaidPending = apt.status === 'Pending' && (apt.paymentStatus === 'Unpaid' || !apt.paymentStatus);
      
      if (apt.bookedVia === 'Advanced Booking') return true;
      
      return !isUnpaidPending;
    });

    let doctorsList = Array.isArray(doctors) ? doctors : (doctors as any).data;

    // 🛡️ SECURITY: Nurse/Staff Blinding (assignedDoctorIds)
    if (assignedDoctorIds && assignedDoctorIds.length > 0) {
      const assignedSet = new Set(assignedDoctorIds);
      doctorsList = doctorsList.filter((d: Doctor) => assignedSet.has(d.id));
      filteredAppointments = filteredAppointments.filter((a: Appointment) => assignedSet.has(a.doctorId));
    }


    if (clinic.registrationStatus !== 'Approved') {
      throw new ClinicNotApprovedError();
    }

    if (clinic.onboardingStatus !== 'Completed') {
      throw new OnboardingIncompleteError();
    }

    // Compute queues for each doctor
    const queues: Record<string, QueueState> = {};

    doctorsList.forEach((doctor: Doctor) => {
      const doctorAppointments = filteredAppointments.filter((apt: Appointment) => apt.doctorId === doctor.id);

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
      currentTime: new Date().toISOString(),
      totalCount,
      hasMore
    };
  }
}
