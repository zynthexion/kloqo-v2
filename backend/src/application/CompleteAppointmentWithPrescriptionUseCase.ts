import { IAppointmentRepository, IClinicRepository, IConsultationCounterRepository, IDoctorRepository } from '../domain/repositories';
import { NotificationService } from '../domain/services/NotificationService';
import { storage } from '../infrastructure/firebase/config';
import { Appointment } from '../../../packages/shared/src/index';
import { format } from 'date-fns';
import { PrescriptionPDFService } from '../infrastructure/pdf/PrescriptionPDFService';

export class CompleteAppointmentWithPrescriptionUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private clinicRepo: IClinicRepository,
    private doctorRepo: IDoctorRepository,
    private counterRepo: IConsultationCounterRepository,
    private notificationService: NotificationService,
    private pdfService: PrescriptionPDFService
  ) {}

  async execute(params: {
    appointmentId: string;
    clinicId: string;
    fileBuffer: Buffer; // Raw Handwriting PNG
    fileMimeType: string;
    patientId: string;
  }): Promise<Appointment> {
    const { appointmentId, clinicId, fileBuffer, fileMimeType, patientId } = params;

    // 1. Validate Entities
    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) throw new Error('Appointment not found');
    if (appointment.clinicId !== clinicId) throw new Error('Unauthorized');

    const [clinic, doctor] = await Promise.all([
      this.clinicRepo.findById(clinicId),
      this.doctorRepo.findById(appointment.doctorId)
    ]);

    if (!clinic) throw new Error('Clinic not found');
    if (!doctor) throw new Error('Doctor not found');

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const bucket = storage.bucket();

    // 2. AUDIT TRAIL: Upload Raw Handwriting (PNG)
    const rawPath = `raw-ink/${clinicId}/${dateStr}/${patientId}_${appointmentId}.png`;
    const rawFileRef = bucket.file(rawPath);
    await rawFileRef.save(fileBuffer, {
      contentType: fileMimeType,
      public: true,
      metadata: { appointmentId, clinicId, patientId, type: 'raw-handwriting' }
    });

    // 3. GENERATION: Composite High-Fidelity PDF
    const pdfBuffer = await this.pdfService.generate({
      appointment,
      clinic,
      doctor,
      inkBuffer: fileBuffer
    });

    // 4. DELIVERY: Upload Final Merged PDF
    const pdfPath = `prescriptions/${clinicId}/${dateStr}/${patientId}_${appointmentId}.pdf`;
    const pdfFileRef = bucket.file(pdfPath);
    await pdfFileRef.save(pdfBuffer, {
      contentType: 'application/pdf',
      public: true,
      metadata: { appointmentId, clinicId, patientId, type: 'composite-pdf' }
    });

    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${pdfPath}`;

    // 5. COMMMIT: Metadata Link (Firestore)
    const updatedData: Partial<Appointment> = {
      status: 'Completed',
      prescriptionUrl: downloadURL,
      pharmacyStatus: 'pending',
      completedAt: new Date(),
    };

    await this.appointmentRepo.update(appointmentId, updatedData);

    // 6. Side Effects: Consultation Counter
    if (appointment.sessionIndex !== undefined) {
      await this.counterRepo.increment(
        clinicId,
        appointment.doctorId,
        appointment.date,
        appointment.sessionIndex
      );
    }

    // 7. WhatsApp Dispatch (Pharmacy)
    if (clinic.pharmacyPhone) {
      await this.notificationService.sendPrescriptionToPharmacy({
        pharmacyPhone: clinic.pharmacyPhone,
        prescriptionUrl: downloadURL,
        patientName: appointment.patientName,
        clinicName: clinic.name,
        clinicId: clinic.id
      });
    }

    // 8. WhatsApp Dispatch (Patient Triage)
    if (appointment.communicationPhone) {
      await this.notificationService.sendPrescriptionTriageToPatient({
        phone: appointment.communicationPhone,
        patientName: appointment.patientName,
        clinicName: clinic.name,
        clinicId: clinic.id,
        appointmentId: appointment.id
      });
    }

    // 9. Notify next patients
    await this.notificationService.notifyNextPatientsWhenCompleted({
      clinicId,
      completedAppointmentId: appointmentId,
      completedAppointment: { ...appointment, ...updatedData },
      clinicName: clinic.name
    });

    return { ...appointment, ...updatedData };
  }
}
