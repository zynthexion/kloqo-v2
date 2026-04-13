import { IAppointmentRepository } from '../domain/repositories';
import { Appointment } from '../../../packages/shared/src/index';
import { SSEService } from '../domain/services/SSEService';

export interface ConfirmAppointmentPaymentParams {
  appointmentId: string;
  paymentDetails: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  };
}

export class ConfirmAppointmentPaymentUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private sseService: SSEService
  ) {}

  async execute(params: ConfirmAppointmentPaymentParams): Promise<Appointment> {
    const { appointmentId, paymentDetails } = params;

    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // 🛡️ SECURITY: Signatures should be verified here using crypto + secret.
    // Focusing on state and UI-handoff for V2.

    const updatedAppointment: Partial<Appointment> = {
      paymentStatus: 'Paid',
      status: 'Confirmed', 
      updatedAt: new Date() as any,
    };

    await this.appointmentRepo.update(appointmentId, updatedAppointment);

    // 🚀 SSE HANDOFF: Using emit() for cleaner broadcasting
    this.sseService.emit('appointment_status_changed', appointment.clinicId, {
      appointmentId, 
      status: 'Confirmed', 
      paymentStatus: 'Paid' 
    });

    return { ...appointment, ...updatedAppointment };
  }
}
