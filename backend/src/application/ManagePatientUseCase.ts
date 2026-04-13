import { IPatientRepository, IDBTransaction } from '../domain/repositories';
import { Patient } from '../../../packages/shared/src/index';
import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';

export interface ManagePatientRequest {
  id?: string;
  name: string;
  phone: string;
  age?: number;
  sex?: 'Male' | 'Female' | 'Other' | '';
  place?: string;
  clinicId: string;
  isLinkPending?: boolean;
}

export class ManagePatientUseCase {
  constructor(private patientRepo: IPatientRepository) {}

  async execute(request: ManagePatientRequest, transaction?: IDBTransaction): Promise<string> {
    const { id, name, phone, age, sex, place, clinicId, isLinkPending } = request;
    const txn = transaction as admin.firestore.Transaction | undefined;

    // Normalize phone once, used throughout.
    const fullPhone = phone
      ? `+91${phone.replace(/\D/g, '').slice(-10)}`
      : '';

    const executeWork = async (t: admin.firestore.Transaction) => {
        if (id) {
            const patientRef = db.collection('patients').doc(id);
            const doc = await t.get(patientRef);
            
            if (!doc.exists) throw new Error('Patient not found');
            const existing = doc.data() as Patient;
            
            const clinicIds = existing.clinicIds || [];
            if (!clinicIds.includes(clinicId)) clinicIds.push(clinicId);
    
            const updateData: any = {
              name: name || existing.name,
              age: age !== undefined ? age : existing.age,
              sex: sex as any,
              place,
              clinicIds,
              isLinkPending: isLinkPending ?? false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (fullPhone) updateData.communicationPhone = fullPhone;
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
    
            t.update(patientRef, updateData);
            return id;
        }

        const snapshot = await t.get(
            db.collection('patients').where('phone', '==', fullPhone)
        );
    
        if (!snapshot.empty) {
            const matchedDoc =
                snapshot.docs.find(d => d.data().name.toLowerCase() === name.toLowerCase()) ||
                snapshot.docs[0];
    
            const existing = matchedDoc.data() as Patient;
            const clinicIds: string[] = [...(existing.clinicIds || [])];
            if (!clinicIds.includes(clinicId)) clinicIds.push(clinicId);
    
            const updateData: any = {
                name: name || existing.name,
                age: age !== undefined ? age : existing.age,
                sex: (sex as any) || existing.sex,
                place: place || existing.place,
                clinicIds,
                isLinkPending: isLinkPending ?? existing.isLinkPending ?? false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (fullPhone) updateData.communicationPhone = fullPhone;
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
    
            t.update(matchedDoc.ref, updateData);
            return matchedDoc.id;
        }
    
        const newId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const newRef = db.collection('patients').doc(newId);
        const newPatient: Patient = {
            id: newId,
            name,
            phone: fullPhone,
            communicationPhone: fullPhone,
            age,
            sex: sex as any,
            place,
            clinicIds: [clinicId],
            isLinkPending: isLinkPending ?? false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
    
        const sanitized: any = { ...newPatient };
        Object.keys(sanitized).forEach(key => sanitized[key] === undefined && delete sanitized[key]);
    
        t.set(newRef, sanitized);
        return newId;
    };

    if (txn) {
       return await executeWork(txn);
    } else {
       return await db.runTransaction(executeWork);
    }
  }
}
