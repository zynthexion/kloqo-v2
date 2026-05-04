import { IDoctorRepository, IAppointmentRepository, IClinicRepository } from '../domain/repositories';
import { compareAppointments, compareAppointmentsClassic } from '../../../packages/shared/src/index';
import { NotificationService } from '../domain/services/NotificationService';
import { format } from 'date-fns';
import { PrescriptionPDFService } from '../infrastructure/pdf/PrescriptionPDFService';
import { getClinicNow } from '../domain/services/DateUtils';
import { SSEService } from '../domain/services/SSEService';

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

    // If doctor marks themselves as 'In', fill the initial buffer and LOCK the first patient
    if (status === 'In') {
        const today = format(now, 'yyyy-MM-dd');
        const appointments = await this.appointmentRepo.findByClinicAndDate(doctor.clinicId, today);
        
        // Filter confirmed appointments for this doctor in this session
        const doctorAppointments = appointments.filter(apt => 
            apt.doctorId === doctor.id && 
            apt.status === 'Confirmed' &&
            (sessionIndex === undefined || apt.sessionIndex === sessionIndex)
        );

        const clinic = await this.clinicRepo.findById(doctor.clinicId);
        const distribution = doctor.tokenDistribution || clinic?.tokenDistribution || 'advanced';

        const sorted = doctorAppointments.sort(distribution === 'advanced' ? compareAppointments : compareAppointmentsClassic);
        
        // 1. Fill Buffer (Top 2)
        const top2 = sorted.slice(0, 2);
        for (const apt of top2) {
            if (!apt.isInBuffer) {
                await this.appointmentRepo.update(apt.id, doctor.clinicId, {
                    isInBuffer: true,
                    bufferedAt: now,
                    updatedAt: now
                });
                console.log(`[DoctorIn] ✅ Promoted ${apt.tokenNumber} to buffer.`);
            }
        }

        // 2. Lock the First Patient (The "Door Lock")
        if (sorted.length > 0) {
            const nextPatient = sorted[0];
            if (!nextPatient.isNextLocked) {
                await this.appointmentRepo.update(nextPatient.id, doctor.clinicId, {
                    isNextLocked: true,
                    lockedAt: now
                });
                
                // 📢 Emit SSE for the newly locked patient so the UI updates immediately
                this.sseService.emit('appointment_status_changed', doctor.clinicId, {
                    appointmentId: nextPatient.id,
                    newStatus: nextPatient.status,
                    isNextLocked: true
                });
                
                console.log(`[DoctorIn] 🔒 Locked ${nextPatient.tokenNumber} as NEXT patient.`);
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
