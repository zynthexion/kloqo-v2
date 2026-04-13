import { IPatientRepository, IUserRepository } from '../domain/repositories';
import { Patient, User, KLOQO_ROLES } from '@kloqo/shared';
import { v4 as uuidv4 } from 'uuid';

export interface AddRelativeRequest {
  primaryPatientId?: string;
  primaryPatientPhone?: string;
  clinicId: string;
  relative: {
    name: string;
    age: number;
    sex: 'Male' | 'Female' | 'Other' | '';
    phone?: string;
    place: string;
  };
}

export class AddRelativeUseCase {
  constructor(
    private patientRepo: IPatientRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(request: AddRelativeRequest): Promise<Patient> {
    const { primaryPatientId, primaryPatientPhone, clinicId, relative } = request;

    let primaryPatient: Patient | undefined;
    let normalizedPrimaryPhone: string = '';

    if (primaryPatientId) {
      const p = await this.patientRepo.findById(primaryPatientId);
      primaryPatient = p || undefined;
      if (primaryPatient) {
        normalizedPrimaryPhone = this.normalizePhone(primaryPatient.phone || primaryPatient.communicationPhone || '');
      }
    } else if (primaryPatientPhone) {
      normalizedPrimaryPhone = this.normalizePhone(primaryPatientPhone);
      const primaryPatients = await this.patientRepo.findByPhone(normalizedPrimaryPhone);
      primaryPatient = primaryPatients.find(p => p.clinicIds?.includes(clinicId));
    }

    if (!primaryPatient) {
      throw new Error('Primary member not found.');
    }

    const relativePhone = relative.phone ? this.normalizePhone(relative.phone) : '';
    const isDuplicatePhone = relativePhone && relativePhone === normalizedPrimaryPhone;
    
    let newRelativeData: Patient;

    if (relativePhone && !isDuplicatePhone) {
      // Case 1: Relative HAS a unique phone number
      const existingPatients = await this.patientRepo.findByPhone(relativePhone);
      if (existingPatients.length > 0) {
        throw new Error('This phone number is already registered to another patient.');
      }

      // Check users
      const existingUser = await this.userRepo.findByPhone(relativePhone);
      if (existingUser) {
        throw new Error('This phone number is already registered to another user.');
      }

      const patientId = `p-${uuidv4().substring(0, 8)}`;
      const userId = `u-${uuidv4().substring(0, 8)}`;

      // Create User
      const newUser: User = {
        id: userId,
        phone: relativePhone,
        role: KLOQO_ROLES.PATIENT,
        roles: [KLOQO_ROLES.PATIENT],
        email: '', // Not provided
        name: relative.name,
        clinicId: clinicId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await this.userRepo.save(newUser);

      // Create Patient as Primary
      newRelativeData = {
        id: patientId,
        name: relative.name,
        age: relative.age,
        sex: relative.sex as any,
        phone: relativePhone,
        communicationPhone: relativePhone,
        place: relative.place,
        clinicIds: [clinicId],
        createdAt: new Date(),
        updatedAt: new Date(),
        relatedPatientIds: []
      };
    } else {
      // Case 2: No phone or same phone as primary
      const patientId = `p-${uuidv4().substring(0, 8)}`;
      newRelativeData = {
        id: patientId,
        name: relative.name,
        age: relative.age,
        sex: relative.sex as any,
        phone: '',
        communicationPhone: primaryPatient.communicationPhone || primaryPatient.phone,
        place: relative.place,
        clinicIds: [clinicId],
        createdAt: new Date(),
        updatedAt: new Date(),
        relatedPatientIds: []
      };
    }

    await this.patientRepo.save(newRelativeData);

    // 2. Link to primary patient
    const primaryRelatedIds = primaryPatient.relatedPatientIds || [];
    if (!primaryRelatedIds.includes(newRelativeData.id)) {
      primaryRelatedIds.push(newRelativeData.id);
      await this.patientRepo.update(primaryPatient.id, {
        relatedPatientIds: primaryRelatedIds,
        updatedAt: new Date()
      });
    }

    return newRelativeData;
  }

  private normalizePhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    return `+91${cleaned}`;
  }
}
