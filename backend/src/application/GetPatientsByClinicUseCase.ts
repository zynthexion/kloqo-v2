import { IPatientRepository, IAppointmentRepository } from '../domain/repositories';
import { Patient, PaginationParams, PaginatedResponse, Appointment } from '../../../packages/shared/src/index';

export interface EnrichedPatient extends Patient {
  lastVisit?: Appointment;
}

export class GetPatientsByClinicUseCase {
  constructor(
    private patientRepo: IPatientRepository,
    private appointmentRepo: IAppointmentRepository
  ) {}

  async execute(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<EnrichedPatient> | EnrichedPatient[]> {
    const result = await this.patientRepo.findByClinicId(clinicId, params);

    if ('data' in result) {
      const enrichedData = await this.enrichPatients(result.data, clinicId);
      return { ...result, data: enrichedData };
    }

    return this.enrichPatients(result, clinicId);
  }

  private async enrichPatients(patients: Patient[], clinicId: string): Promise<EnrichedPatient[]> {
    if (patients.length === 0) return [];

    // ✅ FIX: Replace the N+1 loop with a single batch query.
    //
    // OLD (N+1 — 51 reads for 50 patients):
    //   Promise.all(patients.map(p => appointmentRepo.findLatestByPatientAndClinic(p.id, clinicId)))
    //
    // NEW (2 reads for 50 patients via Firestore `in` query with chunking):
    //   appointmentRepo.findLatestByPatientIds(patientIds, clinicId)
    //
    const patientIds = patients.map(p => p.id);
    const lastVisitMap = await this.appointmentRepo.findLatestByPatientIds(patientIds, clinicId);

    return patients.map(patient => ({
      ...patient,
      lastVisit: lastVisitMap.get(patient.id) || undefined
    }));
  }
}
