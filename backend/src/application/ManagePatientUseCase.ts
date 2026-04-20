import { IPatientRepository, ITransaction } from '../domain/repositories';
import { Patient } from '../../../packages/shared/src/index';
import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';

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

export class ManagePatientUseCase {
  constructor(private patientRepo: IPatientRepository) {}

  async execute(request: ManagePatientRequest, transaction?: ITransaction): Promise<string> {
    const { id, name, phone, communicationPhone, age, sex, place, clinicId, isLinkPending } = request;
    const txn = transaction as admin.firestore.Transaction | undefined;

    // Normalize phone once, used throughout.
    const fullPhone = phone
      ? `+91${phone.replace(/\D/g, '').slice(-10)}`
      : '';
    
    const fullCommPhone = communicationPhone
      ? `+91${communicationPhone.replace(/\D/g, '').slice(-10)}`
      : fullPhone;

    const executeWork = async (t: admin.firestore.Transaction) => {
        // 1. TIERED MATCHING STRATEGY
        let matchedDoc: admin.firestore.DocumentSnapshot | null = null;
        let isPhoneConflict = false;

        // A. Match by ID (Highest priority)
        if (id) {
            const doc = await t.get(db.collection('patients').doc(id));
            if (doc.exists) matchedDoc = doc;
        }

        // B. Match by Unique Phone
        if (!matchedDoc && fullPhone) {
            const phoneSnap = await t.get(db.collection('patients').where('phone', '==', fullPhone));
            if (!phoneSnap.empty) {
                // If phone is found, this is either the person or a conflict (which makes new person a relative)
                const phoneMatch = phoneSnap.docs.find(d => d.data().name?.toLowerCase() === name?.toLowerCase());
                if (phoneMatch) {
                    matchedDoc = phoneMatch;
                } else {
                    isPhoneConflict = true; // Phone belongs to someone else (Primary)
                }
            }
        }

        // C. Match by Name + communicationPhone (Relative match)
        if (!matchedDoc) {
            const relativeSnap = await t.get(
                db.collection('patients')
                  .where('name', '==', name)
                  .where('communicationPhone', '==', fullCommPhone)
            );
            if (!relativeSnap.empty) {
                matchedDoc = relativeSnap.docs[0];
            }
        }

        // 2. DATA PREPARATION
        const isRelative = isPhoneConflict || (fullPhone === '' && fullCommPhone !== '');
        const finalPhone = isRelative ? '' : (fullPhone || '');
        const finalCommPhone = fullCommPhone || fullPhone;

        const targetId = matchedDoc ? matchedDoc.id : `p-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const patientRef = db.collection('patients').doc(targetId);
        
        let updateData: any = {};
        if (matchedDoc) {
            const existing = matchedDoc.data() as Patient;
            const clinicIds = existing.clinicIds || [];
            if (!clinicIds.includes(clinicId)) clinicIds.push(clinicId);

            updateData = {
                name: name || existing.name,
                phone: finalPhone !== '' ? finalPhone : existing.phone,
                communicationPhone: finalCommPhone || existing.communicationPhone,
                age: age !== undefined ? age : existing.age,
                sex: (sex as any) || existing.sex,
                place: place || existing.place,
                clinicIds,
                isLinkPending: isLinkPending ?? existing.isLinkPending ?? false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
        } else {
            updateData = {
                id: targetId,
                name,
                phone: finalPhone,
                communicationPhone: finalCommPhone,
                age,
                sex: sex as any,
                place,
                clinicIds: [clinicId],
                isLinkPending: isLinkPending ?? false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
        }

        // Sanitization: Keep phone as "" if it's a relative, but delete undefined/null
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined || updateData[key] === null) {
                delete updateData[key];
            }
        });

        // 3. TRANSACTIONAL UPDATES (The Write Phase)
        if (matchedDoc) {
            t.update(patientRef, updateData);
        } else {
            t.set(patientRef, updateData);
        }

        // 4. BI-DIRECTIONAL FAMILY LINKING
        if (isRelative) {
            const primarySnap = await t.get(db.collection('patients').where('phone', '==', finalCommPhone));
            if (!primarySnap.empty) {
                const primaryDoc = primarySnap.docs[0];
                // Link relative to primary
                t.update(primaryDoc.ref, {
                    relatedPatientIds: admin.firestore.FieldValue.arrayUnion(targetId)
                });
                // Link primary to relative
                t.update(patientRef, {
                    relatedPatientIds: admin.firestore.FieldValue.arrayUnion(primaryDoc.id)
                });
            }
        }

        // 5. USER PROFILE NAME SYNCHRONIZATION
        // If this is a primary account update, sync with the Users table
        if (!isRelative) {
            const userSnap = await t.get(db.collection('users').where('patientId', '==', targetId));
            if (!userSnap.empty) {
                for (const userDoc of userSnap.docs) {
                    if (userDoc.data().name === 'Patient User') {
                        t.update(userDoc.ref, { name: name });
                        console.log(`[ManagePatient] Syncing name to User ${userDoc.id}: ${name}`);
                    }
                }
            }
        }

        return targetId;
    };

    if (txn) {
       return await executeWork(txn);
    } else {
       return await db.runTransaction(executeWork);
    }
  }
}
