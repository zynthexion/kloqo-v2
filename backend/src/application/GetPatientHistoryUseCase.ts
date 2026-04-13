import { IPatientRepository, IAppointmentRepository } from '../domain/repositories';
import { Patient, Appointment } from '../../../packages/shared/src/index';

export interface PatientHistoryResponse {
  patient: Patient;
  appointments: Appointment[];
}

export class GetPatientHistoryUseCase {
  constructor(
    private patientRepo: IPatientRepository,
    private appointmentRepo: IAppointmentRepository
  ) {}

  async execute(patientId: string, clinicId: string): Promise<PatientHistoryResponse> {
    const patient = await this.patientRepo.findById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    // Verify patient belongs to the clinic
    if (!patient.clinicIds?.includes(clinicId)) {
      throw new Error('Unauthorized: Patient does not belong to this clinic');
    }

    const appointments = await this.appointmentRepo.findAllByPatientAndClinic(patientId, clinicId);

    return {
      patient,
      appointments
    };
  }
}
