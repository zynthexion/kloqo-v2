import { IDoctorRepository, IAppointmentRepository, IClinicRepository } from '../domain/repositories';
import { compareAppointments, compareAppointmentsClassic } from '../../../packages/shared/src/index';
import { NotificationService } from '../domain/services/NotificationService';
import { format } from 'date-fns';
import { PrescriptionPDFService } from '../infrastructure/pdf/PrescriptionPDFService';
import { getClinicNow } from '../domain/services/DateUtils';

export class UpdateDoctorStatusUseCase {
  constructor(
    private doctorRepo: IDoctorRepository,
    private appointmentRepo: IAppointmentRepository,
    private clinicRepo: IClinicRepository,
    private notificationService: NotificationService,
    private sseService: SSEService
  ) {}

  async execute(params: {
    doctorId: string;
    clinicId: string;
    status: 'In' | 'Out';
    sessionIndex?: number;
  }): Promise<void> {
    const { doctorId, clinicId, status, sessionIndex } = params;
    const doctor = await this.doctorRepo.findById(doctorId, clinicId);
    if (!doctor) throw new Error('Doctor not found');

    const now = getClinicNow();
    await this.doctorRepo.update(doctorId, clinicId, {
        consultationStatus: status,
        updatedAt: now
    });

    // If doctor marks themselves as 'In', fill the initial buffer
    if (status === 'In') {
        const today = format(now, 'yyyy-MM-dd');
        const clinic = await this.clinicRepo.findById(doctor.clinicId);
        const tokenDistribution = clinic?.tokenDistribution || 'classic';

        const appointments = await this.appointmentRepo.findByClinicAndDate(doctor.clinicId, today);
        const doctorAppointments = appointments.filter(apt => apt.doctorName === doctor.name && apt.status === 'Confirmed');

        const sorted = doctorAppointments.sort(tokenDistribution === 'advanced' ? compareAppointments : compareAppointmentsClassic);
        
        // Mark top 2 as in buffer
        const top2 = sorted.slice(0, 2);
        for (const apt of top2) {
            if (!apt.isInBuffer) {
                await this.appointmentRepo.update(apt.id, doctor.clinicId, {
                    isInBuffer: true,
                    bufferedAt: now,
                    updatedAt: now
                });
            }
        }
        // Notify patients if sessionIndex is provided
        if (typeof sessionIndex === 'number') {
            await this.notificationService.notifySessionPatientsOfConsultationStart({
                clinicId: doctor.clinicId,
                doctorId: doctor.id,
                date: today,
                sessionIndex
            });
        }
    }

    // ── SSE: Broadcast doctor status change to all connected clinic clients ──
    this.sseService.emit('doctor_status_changed', doctor.clinicId, {
      doctorId: doctor.id,
      doctorName: doctor.name,
      status,
      sessionIndex,
    });
  }
}
