import { NotificationService } from '../domain/services/NotificationService';
import { IClinicRepository, IPatientRepository, IUserRepository } from '../domain/repositories';
import { User, Patient, KLOQO_ROLES } from '../../../packages/shared/src/index';
import { v4 as uuidv4 } from 'uuid';

export class SendBookingLinkUseCase {
  constructor(
    private notificationService: NotificationService,
    private clinicRepo: IClinicRepository,
    private patientRepo: IPatientRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(params: {
    phone: string;
    clinicId: string;
    patientName?: string;
  }): Promise<void> {
    const { phone, clinicId, patientName } = params;

    const clinic = await this.clinicRepo.findById(clinicId);
    if (!clinic) throw new Error('Clinic not found');

    // 1. Check if user exists
    let user = await this.userRepo.findByPhone(phone);
    let patientId = user?.patientId;

    if (user && patientId) {
      // 2. User exists, check patient and add clinicId
      const patient = await this.patientRepo.findById(patientId);
      if (patient) {
        const clinicIds = patient.clinicIds || [];
        if (!clinicIds.includes(clinicId)) {
          await this.patientRepo.update(patientId, {
            clinicIds: [...clinicIds, clinicId],
            updatedAt: new Date()
          });
        }
      }
    } else if (!user) {
      // 3. User doesn't exist, create new records
      const newPatientId = uuidv4();
      const newUserId = uuidv4();

      const newPatient: Patient = {
        id: newPatientId,
        primaryUserId: newUserId,
        phone: phone,
        communicationPhone: phone,
        name: patientName || "",
        place: "",
        email: "",
        clinicIds: [clinicId],
        totalAppointments: 0,
        visitHistory: [],
        relatedPatientIds: [],
        isPrimary: true,
        isKloqoMember: false,
        isLinkPending: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newUser: User = {
        id: newUserId,
        uid: newUserId,
        phone: phone,
        email: "",
        name: "",
        role: KLOQO_ROLES.PATIENT,
        roles: [KLOQO_ROLES.PATIENT],
        patientId: newPatientId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.patientRepo.save(newPatient);
      await this.userRepo.save(newUser);
    }

    // 4. Send notification
    await this.notificationService.sendWhatsAppBookingLink({
      phone,
      clinicName: clinic.name,
      clinicId: clinic.id,
      patientName: patientName || phone
    });
  }
}
