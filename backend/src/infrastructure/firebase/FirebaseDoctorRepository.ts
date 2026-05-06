import { Doctor, PaginationParams, PaginatedResponse, DoctorOverride } from '../../../../packages/shared/src/index';
import { IDoctorRepository, ITransaction } from '../../domain/repositories';
import { db, paginate } from './config';
import * as admin from 'firebase-admin';
import { cacheService, CACHE_TTL, CACHE_KEY } from '../services/CacheService';

export class FirebaseDoctorRepository implements IDoctorRepository {
  private collection = db.collection('doctors');

  async findAll(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Doctor> | Doctor[]> {
    console.log(`[DOCTOR_REPO] findAll called for clinicId: ${JSON.stringify(clinicId)}`);
    let query = this.collection
      .where('clinicId', '==', clinicId);

    if (params) {
      return paginate<Doctor>(query, params);
    }

    const snapshot = await query.limit(100).get();
    const doctors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Doctor));
    
    // In-memory filter for deletion to be resilient to missing field
    return doctors.filter(d => d.isDeleted !== true);
  }

  async findById(id: string, clinicId: string): Promise<Doctor | null> {
    // ✅ CACHE: Doctor profiles are read on nearly every appointment/queue operation.
    const key = CACHE_KEY.doctor(id);
    const cached = cacheService.get<Doctor>(key);
    
    // SECURITY: Validate tenant even on cache hits
    if (cached) {
      if (clinicId !== 'SYSTEM' && cached.clinicId !== clinicId) {
        console.warn(`[SECURITY_ALERT] Potential IDOR attempt (Cache Hit): Clinic ${clinicId} tried to access Doctor ${id}`);
        return null;
      }
      // ✅ CLONE: Return a fresh object to prevent cache poisoning via reference mutation
      return JSON.parse(JSON.stringify(cached));
    }

    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data() as Doctor;
    
    // SECURITY: IDOR Prevention
    if (data.isDeleted === true || (clinicId !== 'SYSTEM' && data.clinicId !== clinicId)) {
      console.warn(`[SECURITY_ALERT] Potential IDOR attempt: Clinic ${clinicId} tried to access Doctor ${id}`);
      return null;
    }

    const doctor = { ...data, id: doc.id };
    cacheService.set(key, doctor, CACHE_TTL.DOCTOR);
    return doctor;
  }

  async findByIds(ids: string[], clinicId: string): Promise<Doctor[]> {
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
    
    // Flatten, map, and filter out deleted/missing/wrong-tenant doctors
    const doctors: Doctor[] = [];
    const seenIds = new Set<string>();

    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const data = doc.data() as Doctor;
        const isClinicMember = clinicId === 'SYSTEM' || data.clinicId === clinicId;
        if (data && data.isDeleted !== true && !seenIds.has(doc.id) && isClinicMember) {
          doctors.push({ ...data, id: doc.id } as Doctor);
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
    return this.findAll(clinicId, params);
  }

  async findByEmail(email: string, clinicId: string): Promise<Doctor | null> {
    let query = this.collection.where('email', '==', email);
    
    if (clinicId !== 'SYSTEM') {
      query = query.where('clinicId', '==', clinicId);
    }

    const snapshot = await query.limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data() as any;
    if (data && data.isDeleted === true) return null;
    return { ...data, id: doc.id } as Doctor;
  }

  async findByUserId(userId: string, clinicId: string): Promise<Doctor | null> {
    // 1. Primary Lookup: Try to find by userId field
    let query = this.collection.where('userId', '==', userId);
    
    if (clinicId !== 'SYSTEM') {
      query = query.where('clinicId', '==', clinicId);
    }

    const snapshot = await query.limit(1).get();
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Doctor;
    }

    // 2. Fallback: This is legacy but still needs isolation
    // We don't have email here, so we can't do more without 'SYSTEM' level access usually.
    return null;
  }

  async update(id: string, clinicId: string, data: Partial<Doctor>, transaction?: ITransaction): Promise<void> {
    const existing = await this.findById(id, clinicId);
    if (!existing) throw new Error('Doctor not found or unauthorized');

    const docRef = this.collection.doc(id);
    const payload = {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (transaction) {
      (transaction as admin.firestore.Transaction).update(docRef, payload);
    } else {
      await docRef.update(payload);
    }

    // ✅ CACHE BUST
    cacheService.del(CACHE_KEY.doctor(id));
    if (clinicId) cacheService.del(CACHE_KEY.doctorsByClinic(clinicId));
  }

  async save(doctor: Doctor, clinicId: string, transaction?: ITransaction): Promise<void> {
    if (!clinicId) throw new Error('[IDOR_GUARD] clinicId is mandatory for repository save operations');
    if (doctor.clinicId !== clinicId) {
        console.error(`[SECURITY_ALERT] Tenant mismatch in DoctorRepo.save: target=${clinicId}, object=${doctor.clinicId}`);
        throw new Error('[IDOR_GUARD] Cannot save doctor to a different clinic context');
    }

    const { id, ...data } = doctor;
    const docRef = this.collection.doc(id);
    const payload = {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (transaction) {
      (transaction as admin.firestore.Transaction).set(docRef, payload, { merge: true });
    } else {
      await docRef.set(payload, { merge: true });
    }
    cacheService.del(CACHE_KEY.doctor(id));
    cacheService.del(CACHE_KEY.doctorsByClinic(clinicId));
  }

  async saveOverride(doctorId: string, clinicId: string, dateStr: string, override: DoctorOverride, transaction?: ITransaction): Promise<void> {
    const existing = await this.findById(doctorId, clinicId);
    if (!existing) throw new Error('Doctor not found or unauthorized');

    const safeDateId = dateStr.replace(/\//g, '-');
    const docRef = this.collection.doc(doctorId).collection('overrides').doc(safeDateId);
    const payload = {
      ...override,
      date: dateStr,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (transaction) {
      (transaction as admin.firestore.Transaction).set(docRef, payload, { merge: true });
    } else {
      await docRef.set(payload, { merge: true });
    }
  }

  async saveBreaks(doctorId: string, clinicId: string, dateStr: string, breaks: any[], transaction?: ITransaction): Promise<void> {
    const existing = await this.findById(doctorId, clinicId);
    if (!existing) throw new Error('Doctor not found or unauthorized');

    const safeDateId = dateStr.replace(/\//g, '-');
    const docRef = this.collection.doc(doctorId).collection('breaks').doc(safeDateId);
    const payload = {
      breaks,
      date: dateStr,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (transaction) {
      (transaction as admin.firestore.Transaction).set(docRef, payload, { merge: true });
    } else {
      await docRef.set(payload, { merge: true });
    }
  }

  async saveLeave(doctorId: string, clinicId: string, dateStr: string, leave: any, transaction?: ITransaction): Promise<void> {
    const existing = await this.findById(doctorId, clinicId);
    if (!existing) throw new Error('Doctor not found or unauthorized');

    const safeDateId = dateStr.replace(/\//g, '-');
    const docRef = this.collection.doc(doctorId).collection('leaves').doc(safeDateId);
    const payload = {
      ...leave,
      date: dateStr,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (transaction) {
      (transaction as admin.firestore.Transaction).set(docRef, payload, { merge: true });
    } else {
      await docRef.set(payload, { merge: true });
    }
  }

  async delete(id: string, clinicId: string, soft: boolean = true, transaction?: ITransaction): Promise<void> {
    const existing = await this.findById(id, clinicId);
    if (!existing) throw new Error('Doctor not found or unauthorized');

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

    cacheService.del(CACHE_KEY.doctor(id));
    cacheService.del(CACHE_KEY.doctorsByClinic(clinicId));
  }

  async countAll(clinicId: string): Promise<number> {
    const snapshot = await this.collection
      .where('clinicId', '==', clinicId)
      .where('isDeleted', '==', false)
      .count()
      .get();
    return snapshot.data().count;
  }

  async countByClinicId(clinicId: string): Promise<number> {
    return this.countAll(clinicId);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async prunePastOverrides(id: string, _clinicId: string, keys: string[]): Promise<void> {
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
