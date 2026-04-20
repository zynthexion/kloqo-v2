import { Clinic, PaginationParams, PaginatedResponse } from '../../../../packages/shared/src/index';
import { IClinicRepository } from '../../domain/repositories';
import { db, paginate } from './config';
import * as admin from 'firebase-admin';
import { cacheService, CACHE_TTL, CACHE_KEY } from '../services/CacheService';

export class FirebaseClinicRepository implements IClinicRepository {
  private collection = db.collection('clinics');

  async findAll(params?: PaginationParams): Promise<PaginatedResponse<Clinic> | Clinic[]> {
    if (params) {
      const query = this.collection.where('isDeleted', '==', false);
      return paginate<Clinic>(query, params);
    }

    // ✅ FIX: Add a sensible default limit to prevent unbounded collection scans.
    // Superadmin list is paginated via params; this guard is for legacy callers.
    const snapshot = await this.collection.limit(500).get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Clinic))
      .filter(clinic => clinic.isDeleted !== true);
  }

  async findById(id: string): Promise<Clinic | null> {
    // ✅ CACHE: Clinic settings are read on every API request.
    // Cache for 10 minutes; invalidated on update/save/delete.
    const key = CACHE_KEY.clinic(id);
    const cached = cacheService.get<Clinic>(key);
    if (cached) return cached;

    const doc = await this.collection.doc(id).get();
    if (!doc.exists || (doc.data() as any).isDeleted === true) return null;
    const clinic = { id: doc.id, ...doc.data() } as Clinic;
    cacheService.set(key, clinic, CACHE_TTL.CLINIC);
    return clinic;
  }

  async findByIds(ids: string[]): Promise<Clinic[]> {
    if (!ids || ids.length === 0) return [];
    
    // Chunk for Firestore limit (30)
    const CHUNK_SIZE = 10;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }

    const snapshotPromises = chunks.map(chunk => 
      this.collection.where(admin.firestore.FieldPath.documentId(), 'in', chunk).get()
    );

    const snapshots = await Promise.all(snapshotPromises);
    const clinics: Clinic[] = [];
    const seenIds = new Set<string>();

    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const data = doc.data() as any;
        if (data && data.isDeleted !== true && !seenIds.has(doc.id)) {
          clinics.push({ id: doc.id, ...data } as Clinic);
          seenIds.add(doc.id);
        }
      });
    });

    return clinics;
  }

  async update(id: string, data: Partial<Clinic>): Promise<void> {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    // ✅ CACHE BUST: Invalidate after every write so next read reflects reality.
    cacheService.del(CACHE_KEY.clinic(id));
  }

  async updateLastSyncAt(id: string, date: Date): Promise<void> {
    await this.collection.doc(id).update({
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    cacheService.del(CACHE_KEY.clinic(id));
  }

  async save(clinic: Clinic): Promise<void> {
    await this.collection.doc(clinic.id).set({
      ...clinic,
      isDeleted: clinic.isDeleted ?? false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    cacheService.del(CACHE_KEY.clinic(clinic.id));
  }

  async delete(id: string, soft: boolean = true): Promise<void> {
    if (soft) {
      await this.collection.doc(id).update({
        isDeleted: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await this.collection.doc(id).delete();
    }
    cacheService.del(CACHE_KEY.clinic(id));
  }

  async countActive(): Promise<number> {
    // ✅ FIX: Use server-side .count() aggregation instead of fetching all docs.
    const snapshot = await this.collection
      .where('onboardingStatus', '==', 'Completed')
      .where('isDeleted', '==', false)
      .count()
      .get();
    return snapshot.data().count;
  }

  async incrementDoctorCount(clinicId: string, delta: 1 | -1): Promise<void> {
    // ✅ Rule 10: Atomic increment using Firestore server-side FieldValue.
    // This prevents race conditions when two doctors are added simultaneously.
    await this.collection.doc(clinicId).update({
      currentDoctorCount: admin.firestore.FieldValue.increment(delta),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Bust cache so subsequent reads reflect the new count.
    cacheService.del(CACHE_KEY.clinic(clinicId));
  }

  async upgradeSubscriptionWithTransaction(clinicId: string, newSettings: any, paymentAmount: number): Promise<void> {
    await db.runTransaction(async (txn) => {
      const clinicRef = this.collection.doc(clinicId);
      const snapshot = await txn.get(clinicRef);

      if (!snapshot.exists) throw new Error("Clinic not found");
      const clinic = snapshot.data() as Clinic;

      if (newSettings.numDoctors < (clinic.numDoctors || 0)) {
        throw new Error("Cannot downgrade number of doctors via this endpoint");
      }

      txn.update(clinicRef, {
        numDoctors: newSettings.numDoctors,
        hardwareChoice: newSettings.hardwareChoice,
        plan: newSettings.plan,
        'subscriptionDetails.expectedNextInvoice': newSettings.newMonthly,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // Clear cache immediately so subsequent reads get the state correctly
    cacheService.del(CACHE_KEY.clinic(clinicId));
  }
}
