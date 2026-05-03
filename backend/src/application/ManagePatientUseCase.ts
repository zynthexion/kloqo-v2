import { IPatientRepository, ITransaction } from '../domain/repositories';
import { Patient } from '../../../packages/shared/src/index';
import { getClinicNow } from '../domain/services/DateUtils';

export interface ManagePatientRequest {
  id?: string;
  name: string;
  phone: string;
  communicationPhone?: string;
  age?: number;
  sex?: 'Male' | 'Female' | 'Other' | '';
  place?: string;
  clinicId: string;
  isLinkPending?: boolean;
}

/**
 * ManagePatientUseCase
 * 
 * Handles patient identification, creation, and profile synchronization.
 * 
 * CLEAN ARCHITECTURE: This use case is infrastructure-agnostic. 
 * It interacts with the database ONLY through the IPatientRepository.
 */
export class ManagePatientUseCase {
  constructor(private patientRepo: IPatientRepository) {}

  async execute(request: ManagePatientRequest, transaction?: ITransaction): Promise<string> {
    const { clinicId } = request;

    // 1. IDENTIFY (READ PHASE)
    const identification = await this.identifyPatient(request, transaction);

    // 2. PERSIST (WRITE PHASE)
    await this.persistPatient(request, identification, clinicId, transaction);

    return identification.targetId;
  }

  /**
   * identifyPatient
   * 
   * Performs ONLY READS to find an existing patient or generate a new ID.
   * Useful for Firestore transactions where all reads must come first.
   */
  async identifyPatient(request: ManagePatientRequest, transaction?: ITransaction) {
    const { id, name, phone, communicationPhone } = request;

    const fullPhone = phone
      ? `+91${phone.replace(/\D/g, '').slice(-10)}`
      : '';
    
    const fullCommPhone = communicationPhone
      ? `+91${communicationPhone.replace(/\D/g, '').slice(-10)}`
      : fullPhone;

    let existingPatient: Patient | null = null;
    let isPhoneConflict = false;

    if (id) {
        existingPatient = await this.patientRepo.findById(id, 'SYSTEM', transaction);
    }

    if (!existingPatient && fullPhone) {
        const phoneMatches = await this.patientRepo.findByPhone(fullPhone, 'SYSTEM', transaction);
        if (phoneMatches.length > 0) {
            const nameMatch = phoneMatches.find(p => p.name?.toLowerCase() === name?.toLowerCase());
            if (nameMatch) {
                existingPatient = nameMatch;
            } else {
                isPhoneConflict = true;
            }
        }
    }

    if (!existingPatient) {
        existingPatient = await this.patientRepo.findByNameAndCommunicationPhone(name, fullCommPhone, 'SYSTEM', transaction);
    }

    const isRelative = isPhoneConflict || (fullPhone === '' && fullCommPhone !== '');
    const finalPhone = isRelative ? '' : (fullPhone || '');
    const finalCommPhone = fullCommPhone || fullPhone;

    const targetId = existingPatient ? existingPatient.id : `p-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // ── FAMILY LINK IDENTIFICATION (READ PHASE) ──
    let primaryPatient: Patient | null = null;
    if (isRelative) {
        const primaries = await this.patientRepo.findByPhone(finalCommPhone, 'SYSTEM', transaction);
        if (primaries.length > 0) primaryPatient = primaries[0];
    }

    return {
        existingPatient,
        targetId,
        isRelative,
        finalPhone,
        finalCommPhone,
        primaryPatient
    };
  }

  /**
   * persistPatient
   * 
   * Performs ONLY WRITES to update or create a patient record.
   * MUST be called after all READS in a transaction.
   */
  async persistPatient(request: ManagePatientRequest, identification: any, clinicId: string, transaction?: ITransaction) {
    const { name, age, sex, place, isLinkPending } = request;
    const { existingPatient, targetId, isRelative, finalPhone, finalCommPhone } = identification;

    const updateData: Partial<Patient> = {
        name: name || existingPatient?.name,
        phone: finalPhone !== '' ? finalPhone : existingPatient?.phone,
        communicationPhone: finalCommPhone || existingPatient?.communicationPhone,
        age: age !== undefined ? age : existingPatient?.age,
        sex: (sex as any) || existingPatient?.sex,
        place: place || existingPatient?.place,
        isLinkPending: isLinkPending ?? existingPatient?.isLinkPending ?? false,
        updatedAt: getClinicNow()
    };

    if (existingPatient) {
        const clinicIds = existingPatient.clinicIds || [];
        if (!clinicIds.includes(clinicId)) clinicIds.push(clinicId);
        updateData.clinicIds = clinicIds;
        await this.patientRepo.update(targetId, clinicId, updateData, transaction);
    } else {
        const newPatient: Patient = {
            ...updateData as Patient,
            id: targetId,
            clinicIds: [clinicId],
            createdAt: getClinicNow()
        };
        await this.patientRepo.save(newPatient, clinicId, transaction);
    }

    // Bi-directional linking (Writes)
    if (isRelative && identification.primaryPatient) {
        const primary = identification.primaryPatient;
        const primaryRelated = primary.relatedPatientIds || [];
        if (!primaryRelated.includes(targetId)) {
            await this.patientRepo.update(primary.id, 'SYSTEM', { 
                relatedPatientIds: [...primaryRelated, targetId] 
            }, transaction);
        }
        const relativeRelated = existingPatient?.relatedPatientIds || [];
        if (!relativeRelated.includes(primary.id)) {
            await this.patientRepo.update(targetId, 'SYSTEM', { 
                relatedPatientIds: [...relativeRelated, primary.id] 
            }, transaction);
        }
    }
  }
}
