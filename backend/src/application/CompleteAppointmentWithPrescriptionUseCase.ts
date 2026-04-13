import { IAppointmentRepository, IClinicRepository, IConsultationCounterRepository } from '../domain/repositories';
import { NotificationService } from '../domain/services/NotificationService';
import { storage } from '../infrastructure/firebase/config';
import { Appointment } from '../../../packages/shared/src/index';
import { format } from 'date-fns';

export class CompleteAppointmentWithPrescriptionUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private clinicRepo: IClinicRepository,
    private counterRepo: IConsultationCounterRepository,
    private notificationService: NotificationService
  ) {}

  async execute(params: {
    appointmentId: string;
    clinicId: string;
    fileBuffer: Buffer;
    fileMimeType: string;
    patientId: string;
  }): Promise<Appointment> {
    const { appointmentId, clinicId, fileBuffer, fileMimeType, patientId } = params;

    // 1. Validate Appointment
    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) throw new Error('Appointment not found');
    if (appointment.clinicId !== clinicId) throw new Error('Unauthorized');

    const clinic = await this.clinicRepo.findById(clinicId);
    if (!clinic) throw new Error('Clinic not found');

    // 2. Step 2: Storage Upload (Firebase Storage)
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const bucket = storage.bucket();
    const filePath = `prescriptions/${clinicId}/${dateStr}/${patientId}.jpg`;
    const fileRef = bucket.file(filePath);

    await fileRef.save(fileBuffer, {
      contentType: fileMimeType,
      public: true,
      metadata: {
        appointmentId,
        clinicId,
        patientId,
      }
    });

    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    // 3. Step 3: Metadata Link (Firestore)
    const updatedData: Partial<Appointment> = {
      status: 'Completed',
      prescriptionUrl: downloadURL,
      pharmacyStatus: 'pending',
      completedAt: new Date(),
    };

    await this.appointmentRepo.update(appointmentId, updatedData);

    // 4. Side Effects: Consultation Counter
    if (appointment.sessionIndex !== undefined) {
      await this.counterRepo.increment(
        clinicId,
        appointment.doctorId,
        appointment.date,
        appointment.sessionIndex
      );
    }

    // 5. WhatsApp Dispatch (Pharmacy)
    if (clinic.pharmacyPhone) {
      await this.notificationService.sendPrescriptionToPharmacy({
        pharmacyPhone: clinic.pharmacyPhone,
        prescriptionUrl: downloadURL,
        patientName: appointment.patientName,
        clinicName: clinic.name,
        clinicId: clinic.id
      });
    }

    // 6. WhatsApp Dispatch (Patient Triage)
    if (appointment.communicationPhone) {
      await this.notificationService.sendPrescriptionTriageToPatient({
        phone: appointment.communicationPhone,
        patientName: appointment.patientName,
        clinicName: clinic.name,
        clinicId: clinic.id,
        appointmentId: appointment.id
      });
    }

    // 7. Notify next patients (Existing logic)
    await this.notificationService.notifyNextPatientsWhenCompleted({
      clinicId,
      completedAppointmentId: appointmentId,
      completedAppointment: { ...appointment, ...updatedData },
      clinicName: clinic.name
    });

    return { ...appointment, ...updatedData };
  }
}
