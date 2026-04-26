import { Doctor, PaginationParams, PaginatedResponse } from '../../../../packages/shared/src/index';
import { IDoctorRepository } from '../../domain/repositories';
import { db, paginate } from './config';
import * as admin from 'firebase-admin';
import { cacheService, CACHE_TTL, CACHE_KEY } from '../services/CacheService';

export class FirebaseDoctorRepository implements IDoctorRepository {
  private collection = db.collection('doctors');

  async findAll(params?: PaginationParams): Promise<PaginatedResponse<Doctor> | Doctor[]> {
    if (params) {
      const query = this.collection.where('isDeleted', '==', false);
      return paginate<Doctor>(query, params);
    }

    // ✅ FINOPS: Added default limit to prevent unbounded fetch
    const snapshot = await this.collection.limit(100).get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Doctor))
      .filter(doc => doc.isDeleted !== true);
  }

  async findById(id: string): Promise<Doctor | null> {
    // ✅ CACHE: Doctor profiles are read on nearly every appointment/queue operation.
    // Cache for 5 minutes; invalidated on any update/save/delete.
    const key = CACHE_KEY.doctor(id);
    const cached = cacheService.get<Doctor>(key);
    if (cached) return cached;

    const doc = await this.collection.doc(id).get();
    if (!doc.exists || (doc.data() as any).isDeleted === true) return null;
    const doctor = { id: doc.id, ...doc.data() } as Doctor;
    cacheService.set(key, doctor, CACHE_TTL.DOCTOR);
    return doctor;
  }

  async findByIds(ids: string[]): Promise<Doctor[]> {
    if (!ids || ids.length === 0) return [];

    // ⚡ PREVENT gRPC ERROR: Firestore 'in' query limit is 30, but we use 10 for safety/parity.
    const CHUNK_SIZE = 10;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + CHUNK_SIZE));
    }

    // Execute queries in parallel
    const snapshotPromises = chunks.map(chunk => 
      this.collection.where(admin.firestore.FieldPath.documentId(), 'in', chunk).get()
    );

    const snapshots = await Promise.all(snapshotPromises);
    
    // Flatten, map, and filter out deleted/missing doctors
    const doctors: Doctor[] = [];
    const seenIds = new Set<string>();

    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const data = doc.data() as any;
        if (data && data.isDeleted !== true && !seenIds.has(doc.id)) {
          doctors.push({ id: doc.id, ...data } as Doctor);
          seenIds.add(doc.id);
        }
      });
    });

    return doctors;
  }

  async findByName(clinicId: string, name: string): Promise<Doctor | null> {
    const snapshot = await this.collection
      .where('clinicId', '==', clinicId)
      .where('name', '==', name)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const doctor = { id: doc.id, ...doc.data() } as Doctor;
    return doctor.isDeleted !== true ? doctor : null;
  }

  async findByClinicId(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Doctor> | Doctor[]> {
    // ✅ CACHE: Clinic doctor lists are read on every SSE refresh and dashboard load.
    if (!params) {
      const key = CACHE_KEY.doctorsByClinic(clinicId);
      const cached = cacheService.get<Doctor[]>(key);
      if (cached) return cached;

      const query = this.collection.where('clinicId', '==', clinicId).limit(100);
      const snapshot = await query.get();
      const docs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Doctor))
        .filter(doc => !doc.isDeleted);
      cacheService.set(key, docs, CACHE_TTL.DOCTOR);
      return docs;
    }

    const query = this.collection.where('clinicId', '==', clinicId);
    return paginate<Doctor>(query, params);
  }

  async findByEmail(email: string): Promise<Doctor | null> {
    const snapshot = await this.collection.where('email', '==', email).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data() as any;
    if (data && data.isDeleted === true) return null;
    return { id: doc.id, ...data } as Doctor;
  }

  async findByUserId(userId: string, email?: string): Promise<Doctor | null> {
    // 1. Primary Lookup: Try to find by userId field
    const snapshot = await this.collection.where('userId', '==', userId).limit(1).get();
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Doctor;
    }

    // 2. Legacy Fallback: If not found by UID but email is provided
    if (email) {
      const doctor = await this.findByEmail(email);
      if (doctor) {
        // 🚀 READ-REPAIR: Asynchronously stamp the userId onto the legacy record
        this.collection.doc(doctor.id).update({ 
          userId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.error(`[Read-Repair] Failed to stamp userId ${userId} on doctor ${doctor.id}:`, err));
        
        return { ...doctor, userId };
      }
    }

    return null;
  }

  async update(id: string, data: Partial<Doctor>): Promise<void> {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    // ✅ CACHE BUST: Invalidate individual doctor and the clinic-level doctor list.
    const doc = await this.collection.doc(id).get();
    const clinicId = doc.data()?.clinicId;
    cacheService.del(CACHE_KEY.doctor(id));
    if (clinicId) cacheService.del(CACHE_KEY.doctorsByClinic(clinicId));
  }

  async save(doctor: Doctor): Promise<void> {
    await this.collection.doc(doctor.id).set({
      ...doctor,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    cacheService.del(CACHE_KEY.doctor(doctor.id));
    if (doctor.clinicId) cacheService.del(CACHE_KEY.doctorsByClinic(doctor.clinicId));
  }

  async delete(id: string, soft: boolean = true): Promise<void> {
    const doc = await this.collection.doc(id).get();
    const clinicId = doc.data()?.clinicId;

    if (soft) {
      await this.collection.doc(id).update({
        isDeleted: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await this.collection.doc(id).delete();
    }
    cacheService.del(CACHE_KEY.doctor(id));
    if (clinicId) cacheService.del(CACHE_KEY.doctorsByClinic(clinicId));
  }

  async prunePastOverrides(id: string, keys: string[]): Promise<void> {
    if (!keys || keys.length === 0) return;

    const updatePayload: Record<string, any> = {};
    keys.forEach(key => {
      updatePayload[`dateOverrides.${key}`] = admin.firestore.FieldValue.delete();
    });

    await this.collection.doc(id).update({
      ...updatePayload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // BUST CACHE
    const doc = await this.collection.doc(id).get();
    const clinicId = doc.data()?.clinicId;
    cacheService.del(CACHE_KEY.doctor(id));
    if (clinicId) cacheService.del(CACHE_KEY.doctorsByClinic(clinicId));
  }

  invalidateCache(id: string, clinicId?: string): void {
    cacheService.del(CACHE_KEY.doctor(id));
    if (clinicId) cacheService.del(CACHE_KEY.doctorsByClinic(clinicId));
  }
}
