import { Prescription } from '../../../../packages/shared/src/index';
import { IPrescriptionRepository } from '../../domain/repositories';
import { db } from './config';
import * as admin from 'firebase-admin';

export class FirebasePrescriptionRepository implements IPrescriptionRepository {
  private collection = db.collection('prescriptions');

  async save(prescription: Prescription): Promise<void> {
    const docRef = prescription.id ? this.collection.doc(prescription.id) : this.collection.doc();
    const id = docRef.id;
    
    await docRef.set({
      ...prescription,
      id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: prescription.createdAt || admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async findById(id: string): Promise<Prescription | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Prescription;
  }

  async findByClinicId(clinicId: string): Promise<Prescription[]> {
    const snapshot = await this.collection
      .where('clinicId', '==', clinicId)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prescription));
  }

  async findByPatientId(patientId: string): Promise<Prescription[]> {
    const snapshot = await this.collection
      .where('patientId', '==', patientId)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prescription));
  }

  async findByClinicAndDateRange(clinicId: string, startDate: Date, endDate: Date): Promise<Prescription[]> {
    const snapshot = await this.collection
      .where('clinicId', '==', clinicId)
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prescription));
  }
}
