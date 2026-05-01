import { IPatientRepository, ITransaction } from '../domain/repositories';
import { Patient } from '../../../packages/shared/src/index';

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
    const { id, name, phone, communicationPhone, age, sex, place, clinicId, isLinkPending } = request;

    // Normalize phone once, used throughout.
    const fullPhone = phone
      ? `+91${phone.replace(/\D/g, '').slice(-10)}`
      : '';
    
    const fullCommPhone = communicationPhone
      ? `+91${communicationPhone.replace(/\D/g, '').slice(-10)}`
      : fullPhone;

    // 1. TIERED MATCHING STRATEGY (Infrastructure-agnostic)
    let existingPatient: Patient | null = null;
    let isPhoneConflict = false;

    // A. Match by ID
    if (id) {
        existingPatient = await this.patientRepo.findById(id, 'SYSTEM', transaction);
    }

    // B. Match by Unique Phone
    if (!existingPatient && fullPhone) {
        const phoneMatches = await this.patientRepo.findByPhone(fullPhone, 'SYSTEM', transaction);
        if (phoneMatches.length > 0) {
            const nameMatch = phoneMatches.find(p => p.name?.toLowerCase() === name?.toLowerCase());
            if (nameMatch) {
                existingPatient = nameMatch;
            } else {
                isPhoneConflict = true; // Phone belongs to someone else (Primary)
            }
        }
    }

    // C. Match by Name + communicationPhone (Relative match)
    if (!existingPatient) {
        existingPatient = await this.patientRepo.findByNameAndCommunicationPhone(name, fullCommPhone, 'SYSTEM', transaction);
    }

    // 2. DATA PREPARATION
    const isRelative = isPhoneConflict || (fullPhone === '' && fullCommPhone !== '');
    const finalPhone = isRelative ? '' : (fullPhone || '');
    const finalCommPhone = fullCommPhone || fullPhone;

    const targetId = existingPatient ? existingPatient.id : `p-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // 3. UPDATE OR CREATE
    const updateData: Partial<Patient> = {
        name: name || existingPatient?.name,
        phone: finalPhone !== '' ? finalPhone : existingPatient?.phone,
        communicationPhone: finalCommPhone || existingPatient?.communicationPhone,
        age: age !== undefined ? age : existingPatient?.age,
        sex: (sex as any) || existingPatient?.sex,
        place: place || existingPatient?.place,
        isLinkPending: isLinkPending ?? existingPatient?.isLinkPending ?? false,
    };

    if (existingPatient) {
        const clinicIds = existingPatient.clinicIds || [];
        if (!clinicIds.includes(clinicId)) clinicIds.push(clinicId);
        updateData.clinicIds = clinicIds;
        await this.patientRepo.update(targetId, clinicId, updateData, transaction);
    } else {
        const newPatient: Patient = {
            id: targetId,
            ...updateData as Patient,
            clinicIds: [clinicId],
        };
        await this.patientRepo.save(newPatient, clinicId, transaction);
    }

    // 4. BI-DIRECTIONAL FAMILY LINKING
    // Note: unlinking/linking logic could be further moved to domain services if it gets complex.
    if (isRelative) {
        const primaries = await this.patientRepo.findByPhone(finalCommPhone, 'SYSTEM', transaction);
        if (primaries.length > 0) {
            const primary = primaries[0];
            // Update primary's related list
            const primaryRelated = primary.relatedPatientIds || [];
            if (!primaryRelated.includes(targetId)) {
                await this.patientRepo.update(primary.id, 'SYSTEM', { 
                    relatedPatientIds: [...primaryRelated, targetId] 
                }, transaction);
            }
            // Update relative's related list
            const relativeRelated = existingPatient?.relatedPatientIds || [];
            if (!relativeRelated.includes(primary.id)) {
                await this.patientRepo.update(targetId, 'SYSTEM', { 
                    relatedPatientIds: [...relativeRelated, primary.id] 
                }, transaction);
            }
        }
    }

    return targetId;
  }
}
