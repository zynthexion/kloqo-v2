import { Patient, PaginationParams, PaginatedResponse } from '../../../../packages/shared/src/index';
import { IPatientRepository, ITransaction } from '../../domain/repositories';
import * as admin from 'firebase-admin';
import { db, paginate } from './config';

export class FirebasePatientRepository implements IPatientRepository {
  private collection = db.collection('patients');

  async findAll(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Patient> | Patient[]> {
    let query = this.collection
      .where('clinicIds', 'array-contains', clinicId)
      .where('isDeleted', '==', false);

    if (params) {
      return paginate<Patient>(query, params);
    }

    const snapshot = await query.limit(500).get();
    
    if (snapshot.size === 500) {
      throw new (require('../../domain/errors').QueryBoundaryExceededError)();
    }

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
  }

  async findById(id: string, clinicId: string, transaction?: ITransaction): Promise<Patient | null> {
    const docRef = this.collection.doc(id);
    const doc = transaction ? await (transaction as admin.firestore.Transaction).get(docRef) : await docRef.get();
    if (!doc.exists) return null;
    const data = doc.data() as Patient;
    
    // SECURITY: IDOR Prevention. 'SYSTEM' bypass allowed for internal lookups.
    if (clinicId !== 'SYSTEM' && (data.isDeleted === true || !data.clinicIds?.includes(clinicId))) {
      console.warn(`[SECURITY_ALERT] Potential IDOR attempt: Clinic ${clinicId} tried to access Patient ${id}`);
      return null;
    }
    
    return { id: doc.id, ...data };
  }

  async findByPhone(phone: string, clinicId: string, transaction?: ITransaction): Promise<Patient[]> {
    let query = this.collection.where('phone', '==', phone);
    
    if (clinicId !== 'SYSTEM') {
      query = query.where('clinicIds', 'array-contains', clinicId);
    }

    const snapshot = transaction ? await (transaction as admin.firestore.Transaction).get(query.limit(500)) : await query.limit(500).get();
    
    if (snapshot.size === 500) {
      throw new (require('../../domain/errors').QueryBoundaryExceededError)();
    }

    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Patient))
      .filter(p => p.isDeleted !== true);
  }

  async findByCommunicationPhone(phone: string, clinicId: string, transaction?: ITransaction): Promise<Patient[]> {
    let query = this.collection.where('communicationPhone', '==', phone);
    
    if (clinicId !== 'SYSTEM') {
      query = query.where('clinicIds', 'array-contains', clinicId);
    }

    const snapshot = transaction ? await (transaction as admin.firestore.Transaction).get(query.limit(500)) : await query.limit(500).get();
    
    if (snapshot.size === 500) {
      throw new (require('../../domain/errors').QueryBoundaryExceededError)();
    }

    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Patient))
      .filter(p => p.isDeleted !== true);
  }

  async findByNameAndPhone(name: string, phone: string, clinicId: string): Promise<Patient | null> {
    let query = this.collection
      .where('name', '==', name)
      .where('phone', '==', phone);

    if (clinicId !== 'SYSTEM') {
      query = query.where('clinicIds', 'array-contains', clinicId);
    }

    const snapshot = await query.limit(1).get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data() as Patient;
    return data.isDeleted ? null : { id: doc.id, ...data };
  }

  async findByNameAndCommunicationPhone(name: string, phone: string, clinicId: string, transaction?: ITransaction): Promise<Patient | null> {
    let query = this.collection
      .where('name', '==', name)
      .where('communicationPhone', '==', phone);

    if (clinicId !== 'SYSTEM') {
      query = query.where('clinicIds', 'array-contains', clinicId);
    }

    const snapshot = transaction ? await (transaction as admin.firestore.Transaction).get(query.limit(1)) : await query.limit(1).get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data() as Patient;
    return data.isDeleted ? null : { id: doc.id, ...data };
  }

  async countAll(): Promise<number> {
    const snapshot = await this.collection.where('isDeleted', '==', false).count().get();
    return snapshot.data().count;
  }

  async delete(id: string, clinicId: string, soft: boolean = true, transaction?: ITransaction): Promise<void> {
    const patient = await this.findById(id, clinicId);
    if (!patient) throw new Error('Patient not found or unauthorized');

    const docRef = this.collection.doc(id);
    const data = soft ? {
      isDeleted: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    } : null;

    if (transaction) {
      const t = transaction as admin.firestore.Transaction;
      if (soft) t.update(docRef, data!);
      else t.delete(docRef);
    } else {
      if (soft) await docRef.update(data!);
      else await docRef.delete();
    }
  }

  async countByClinicId(clinicId: string): Promise<number> {
    const snapshot = await this.collection
      .where('clinicIds', 'array-contains', clinicId)
      .where('isDeleted', '==', false)
      .count()
      .get();
    return snapshot.data().count;
  }

  async findByPatientIds(ids: string[], clinicId: string): Promise<Patient[]> {
    if (!ids || ids.length === 0) return [];

    const CHUNK_SIZE = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }

    const snapshotPromises = chunks.map(chunk => 
      this.collection.where(admin.firestore.FieldPath.documentId(), 'in', chunk).get()
    );

    const snapshots = await Promise.all(snapshotPromises);
    const patients: Patient[] = [];
    const seenIds = new Set<string>();

    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const data = doc.data() as Patient;
        // SECURITY: Filter by clinicId unless 'SYSTEM'
        const isClinicMember = clinicId === 'SYSTEM' || data.clinicIds?.includes(clinicId);
        if (data && !data.isDeleted && !seenIds.has(doc.id) && isClinicMember) {
          patients.push({ id: doc.id, ...data });
          seenIds.add(doc.id);
        }
      });
    });

    return patients;
  }

  async save(patient: Patient, clinicId: string, transaction?: ITransaction): Promise<void> {
    const { id, ...data } = patient;
    const docRef = this.collection.doc(id);
    const payload = {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: (data as any).createdAt || admin.firestore.FieldValue.serverTimestamp()
    };

    if (transaction) {
      (transaction as admin.firestore.Transaction).set(docRef, payload);
    } else {
      await docRef.set(payload);
    }
  }

  async update(id: string, clinicId: string, patient: Partial<Patient>, transaction?: ITransaction): Promise<void> {
    const existing = await this.findById(id, clinicId);
    if (!existing) throw new Error('Patient not found or unauthorized');

    const docRef = this.collection.doc(id);
    const payload = {
      ...patient,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (transaction) {
      (transaction as admin.firestore.Transaction).update(docRef, payload);
    } else {
      await docRef.update(payload);
    }
  }

  async findLinkPending(clinicId: string): Promise<Patient[]> {
    const snapshot = await this.collection
      .where('clinicIds', 'array-contains', clinicId)
      .where('isDeleted', '==', false)
      .where('isLinkPending', '==', true)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
  }

  async findByClinicId(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Patient> | Patient[]> {
    return this.findAll(clinicId, params);
  }

  async unlinkRelative(primaryId: string, relativeId: string, clinicId: string): Promise<void> {
    const existing = await this.findById(primaryId, clinicId);
    if (!existing) throw new Error('Primary patient not found or unauthorized');

    const admin = await import('firebase-admin');
    await this.collection.doc(primaryId).update({
      relatedPatientIds: admin.firestore.FieldValue.arrayRemove(relativeId),
      updatedAt: new Date()
    });
  }

  async runTransaction<T>(action: (transaction: ITransaction) => Promise<T>): Promise<T> {
    return db.runTransaction(async (t) => {
      return action(t);
    });
  }
}
