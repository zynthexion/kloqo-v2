import { IAppointmentRepository } from '../domain/repositories';
import { Appointment, PaginationParams, PaginatedResponse } from '../../../packages/shared/src/index';

export class GetAllAppointmentsUseCase {
  constructor(private appointmentRepo: IAppointmentRepository) {}

  async execute(params?: PaginationParams): Promise<PaginatedResponse<Appointment> | Appointment[]> {
    return this.appointmentRepo.findAll(params);
  }
}
