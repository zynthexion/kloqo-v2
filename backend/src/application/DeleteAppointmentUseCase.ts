import { IAppointmentRepository } from '../domain/repositories';

export class DeleteAppointmentUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository
  ) {}

  async execute(params: { appointmentId: string; clinicId: string }): Promise<void> {
    const { appointmentId, clinicId } = params;

    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.clinicId !== clinicId) {
      throw new Error('Unauthorized: Appointment does not belong to this clinic');
    }

    await this.appointmentRepo.delete(appointmentId);

    // Release the atomic lock if the appointment had one (advanced bookings)
    if (appointment.slotIndex !== undefined && appointment.sessionIndex !== undefined) {
      const lockId = `${appointment.doctorId}_${appointment.date}_s${appointment.sessionIndex}_slot${appointment.slotIndex}`;
      await this.appointmentRepo.releaseSlotLock(lockId).catch(err => {
        console.warn(`[Delete] Failed to release lock ${lockId} for ${appointmentId}:`, err.message);
      });
    }
  }
}
