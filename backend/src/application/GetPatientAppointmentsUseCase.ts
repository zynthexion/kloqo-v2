import { Appointment } from '../../../packages/shared/src/index';
import { IAppointmentRepository } from '../domain/repositories';

export class GetPatientAppointmentsUseCase {
  constructor(private appointmentRepository: IAppointmentRepository) {}

  async execute(patientId: string): Promise<Appointment[]> {
    if (!patientId) {
      throw new Error('patientId is required');
    }

    const appointments = await this.appointmentRepository.findByPatientId(patientId);
    return appointments;
  }
}
