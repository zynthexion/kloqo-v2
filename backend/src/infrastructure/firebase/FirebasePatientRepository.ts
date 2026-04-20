import { Patient, PaginationParams, PaginatedResponse } from '../../../../packages/shared/src/index';
import { IPatientRepository, ITransaction } from '../../domain/repositories';
import * as admin from 'firebase-admin';
import { db, paginate } from './config';

export class FirebasePatientRepository implements IPatientRepository {
  private collection = db.collection('patients');

  async findAll(params?: PaginationParams): Promise<PaginatedResponse<Patient> | Patient[]> {
    let query = this.collection.where('isDeleted', '==', false);

    if (params) {
      return paginate<Patient>(query, params);
    }

    // ✅ FIX: Add a sensible default limit to prevent unbounded collection scans.
    const snapshot = await query.limit(500).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
  }

  async findById(id: string): Promise<Patient | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists || (doc.data() as any).isDeleted === true) return null;
    return { id: doc.id, ...doc.data() } as Patient;
  }

  async findByPhone(phone: string): Promise<Patient[]> {
    const snapshot = await this.collection.where('phone', '==', phone).get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Patient))
      .filter(p => p.isDeleted !== true);
  }

  async findByPhoneAndClinic(phone: string, clinicId: string): Promise<Patient[]> {
    const snapshot = await this.collection
      .where('phone', '==', phone)
      .where('clinicIds', 'array-contains', clinicId)
      .get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Patient))
      .filter(p => p.isDeleted !== true);
  }

  async findByCommunicationPhone(phone: string): Promise<Patient[]> {
    const snapshot = await this.collection.where('communicationPhone', '==', phone).get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Patient))
      .filter(p => p.isDeleted !== true);
  }

  async findByCommunicationPhoneAndClinic(phone: string, clinicId: string): Promise<Patient[]> {
    const snapshot = await this.collection
      .where('communicationPhone', '==', phone)
      .where('clinicIds', 'array-contains', clinicId)
      .get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Patient))
      .filter(p => p.isDeleted !== true);
  }

  async countAll(): Promise<number> {
    // ✅ FIX: Use server-side .count() aggregation instead of fetching every patient doc.
    // Old: fetched ALL docs and called .length on the array → O(N) reads.
    // New: Firestore computes this server-side → 1 read (aggregation query).
    const snapshot = await this.collection.where('isDeleted', '==', false).count().get();
    return snapshot.data().count;
  }

  async delete(id: string, soft: boolean = true): Promise<void> {
    if (soft) {
      await this.collection.doc(id).update({
        isDeleted: true,
        updatedAt: new Date()
      });
    } else {
      await this.collection.doc(id).delete();
    }
  }

  async save(patient: Patient, transaction?: ITransaction): Promise<void> {
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

  async update(id: string, patient: Partial<Patient>, transaction?: ITransaction): Promise<void> {
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
    // ✅ FIX: Add server-side filter for isLinkPending to reduce docs transferred.
    const snapshot = await this.collection
      .where('clinicIds', 'array-contains', clinicId)
      .where('isDeleted', '==', false)
      .where('isLinkPending', '==', true)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
  }

  async findByClinicId(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Patient> | Patient[]> {
    let query = this.collection
      .where('clinicIds', 'array-contains', clinicId)
      .where('isDeleted', '==', false);

    if (params) {
      if (params.search) {
        // Simple search by name (prefix match)
        query = query.where('name', '>=', params.search)
          .where('name', '<=', params.search + '\uf8ff');
      }
      return paginate<Patient>(query, params);
    }

    // ✅ FINOPS: Added default limit to prevent unbounded fetch of patients
    const snapshot = await query.limit(100).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
  }

  async unlinkRelative(primaryId: string, relativeId: string): Promise<void> {
    const admin = await import('firebase-admin');
    await this.collection.doc(primaryId).update({
      relatedPatientIds: admin.firestore.FieldValue.arrayRemove(relativeId),
      updatedAt: new Date()
    });
  }
}
