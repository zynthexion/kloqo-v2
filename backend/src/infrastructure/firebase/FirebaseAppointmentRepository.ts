import { Appointment, PaginationParams, PaginatedResponse } from '../../../../packages/shared/src/index';
import * as admin from 'firebase-admin';
import { IAppointmentRepository, ITransaction } from '../../domain/repositories';
import { db, paginate } from './config';
import { getClinicDateString, getClinicISODateString, parseClinicDate } from '../../domain/services/DateUtils';

export class FirebaseAppointmentRepository implements IAppointmentRepository {
  private collection = db.collection('appointments');

  async findAll(params?: PaginationParams & { clinicId?: string }): Promise<PaginatedResponse<Appointment> | Appointment[]> {
    // ─── SECURITY: Multi-tenancy enforcement ─────────────────────────────────
    // An un-scoped findAll would return EVERY appointment across ALL clinics.
    // This is a catastrophic data-leak for a multi-tenant SaaS. Callers MUST
    // supply a clinicId. The sole exception is the Superadmin dashboard which
    // is separately guarded by authenticateToken + checkRole('superAdmin').
    if (!params?.clinicId) {
      throw new Error(
        'SECURITY_CRITICAL: findAll() called without a clinicId scope. ' +
        'This is forbidden in a multi-tenant context. ' +
        'Pass { clinicId } in params or use a scoped repository method.'
      );
    }

    let query: admin.firestore.Query = this.collection.where('clinicId', '==', params.clinicId);

    if (params) {
      // Strip out clinicId before forwarding to the paginator so the paginator
      // doesn't try to use it as a Firestore ordering / limit field.
      const { clinicId: _stripped, ...paginationParams } = params;
      return paginate<Appointment>(query, paginationParams as PaginationParams);
    }

    const snapshot = await query.get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
    return docs.filter(doc => !doc.isDeleted);
  }

  async findById(id: string): Promise<Appointment | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists || (doc.data() as any).isDeleted) return null;
    return { id: doc.id, ...doc.data() } as Appointment;
  }

  async findByDoctorAndDate(doctorId: string, dateStr: string): Promise<Appointment[]> {
    const date = parseClinicDate(dateStr);
    const variations = [getClinicISODateString(date), getClinicDateString(date)];
    
    console.log('[REPOSITORY_DEBUG] findByDoctorAndDate variations:', variations);

    const snapshot = await this.collection
      .where('doctorId', '==', doctorId)
      .where('date', 'in', variations)
      .get();

    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
    return docs.filter(doc => !doc.isDeleted);
  }

  async findByClinicAndDate(clinicId: string, dateStr: string): Promise<Appointment[]> {
    const date = parseClinicDate(dateStr);
    const variations = [getClinicISODateString(date), getClinicDateString(date)];

    console.log('[REPOSITORY_DEBUG] findByClinicAndDate variations:', variations);

    const snapshot = await this.collection
      .where('clinicId', '==', clinicId)
      .where('date', 'in', variations)
      .get();

    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
    return docs.filter(doc => !doc.isDeleted);
  }

  async findByClinicId(clinicId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]> {
    let query: admin.firestore.Query = this.collection.where('clinicId', '==', clinicId);

    // ✅ FINOPS: Database-level filtering for date boundaries
    if (startDate && endDate) {
      query = query.where('createdAt', '>=', startDate).where('createdAt', '<=', endDate);
    }

    const snapshot = await query.get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
    return docs.filter(doc => !doc.isDeleted);
  }

  async save(appointment: Appointment, transaction?: ITransaction): Promise<void> {
    const data: any = {
      ...appointment,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

    const docRef = this.collection.doc(appointment.id);
    if (transaction) {
      (transaction as admin.firestore.Transaction).set(docRef, data);
    } else {
      await docRef.set(data);
    }
  }

  async update(id: string, data: Partial<Appointment>, transaction?: ITransaction): Promise<void> {
    const updateData: any = {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const docRef = this.collection.doc(id);
    if (transaction) {
      (transaction as admin.firestore.Transaction).update(docRef, updateData);
    } else {
      await docRef.update(updateData);
    }
  }

  async countByStatus(clinicId: string, status: string, start?: Date, end?: Date): Promise<number> {
    let query: admin.firestore.Query = this.collection
      .where('clinicId', '==', clinicId)
      .where('status', '==', status)
      .where('isDeleted', '==', false);

    if (start && end) {
      query = query.where('createdAt', '>=', start).where('createdAt', '<=', end);
    }

    // ✅ FINOPS: Use native aggregation query (~0.01x cost of .get())
    const snapshot = await query.count().get();
    return snapshot.data().count;
  }

  async countByPharmacyStatus(clinicId: string, status: string, start?: Date, end?: Date): Promise<number> {
    let query: admin.firestore.Query = this.collection
      .where('clinicId', '==', clinicId)
      .where('pharmacyStatus', '==', status)
      .where('isDeleted', '==', false);

    if (start && end) {
      query = query.where('completedAt', '>=', start).where('completedAt', '<=', end);
    }

    // ✅ FINOPS: Use native aggregation query
    const snapshot = await query.count().get();
    return snapshot.data().count;
  }

  async findCompletedByClinic(clinicId: string, filters: { doctorId?: string; pharmacyStatus?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<Appointment[]> {
    let query: admin.firestore.Query = this.collection.where('status', '==', 'Completed');
    
    // Scoped search only if clinicId is provided
    if (clinicId) {
      query = query.where('clinicId', '==', clinicId);
    }

    if (filters.doctorId) query = query.where('doctorId', '==', filters.doctorId);
    if (filters.pharmacyStatus) query = query.where('pharmacyStatus', '==', filters.pharmacyStatus);
    if (filters.startDate && filters.endDate) {
      query = query.where('completedAt', '>=', filters.startDate).where('completedAt', '<=', filters.endDate);
    }

    query = query.orderBy('completedAt', 'desc');
    if (filters.limit) query = query.limit(filters.limit);

    const snapshot = await query.get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
    // Only return appointments that have a prescription image
    return docs.filter(doc => !doc.isDeleted && !!doc.prescriptionUrl);
  }

  async findCompletedByPatientInClinic(patientId: string, clinicId: string): Promise<Appointment[]> {
    const snapshot = await this.collection
      .where('patientId', '==', patientId)
      .where('clinicId', '==', clinicId)
      .where('status', '==', 'Completed')
      .orderBy('completedAt', 'desc')
      .get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
    return docs.filter(doc => !doc.isDeleted && !!doc.prescriptionUrl);
  }

  async incrementTokenCounter(counterId: string, isClassic: boolean, transaction?: ITransaction): Promise<number> {
    const safeCounterId = counterId.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const counterRef = db.collection('token-counters').doc(safeCounterId);

    const executeInTxn = async (txn: admin.firestore.Transaction) => {
      const doc = await txn.get(counterRef);
      const count = doc.exists ? (doc.data()?.count || 0) + 1 : 1;

      const payload: any = {
        count,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (isClassic) {
        payload.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
      }

      txn.set(counterRef, payload);
      return count;
    };

    if (transaction) {
      return await executeInTxn(transaction as admin.firestore.Transaction);
    } else {
      return await db.runTransaction(executeInTxn);
    }
  }

  async findLatestByPatientAndClinic(patientId: string, clinicId: string): Promise<Appointment | null> {
    const snapshot = await this.collection
      .where('patientId', '==', patientId)
      .where('clinicId', '==', clinicId)
      .where('isDeleted', '==', false)
      .orderBy('date', 'desc')
      .orderBy('time', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Appointment;
  }

  /**
   * Batch fetch the latest appointment for each patient in a single clinic.
   * ✅ FIX: Replaces the N+1 loop in GetPatientsByClinicUseCase.
   * Firestore `in` supports max 30 items; we chunk accordingly.
   * 50 patients → 50 reads (old) vs. 2 reads (new).
   */
  async findLatestByPatientIds(patientIds: string[], clinicId: string): Promise<Map<string, Appointment>> {
    const result = new Map<string, Appointment>();
    if (patientIds.length === 0) return result;

    // Chunk into groups of 30 (Firestore `in` limit)
    const CHUNK_SIZE = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < patientIds.length; i += CHUNK_SIZE) {
      chunks.push(patientIds.slice(i, i + CHUNK_SIZE));
    }

    // Fetch all chunks in parallel — ⌈N/30⌉ reads instead of N
    const snapshots = await Promise.all(
      chunks.map(chunk =>
        this.collection
          .where('patientId', 'in', chunk)
          .where('clinicId', '==', clinicId)
          .where('isDeleted', '==', false)
          .orderBy('date', 'desc')
          .get()
      )
    );

    // Merge: keep only the most recent appointment per patient
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => {
        const apt = { id: doc.id, ...doc.data() } as Appointment;
        const existing = result.get(apt.patientId);
        if (!existing || apt.date > existing.date) {
          result.set(apt.patientId, apt);
        }
      });
    });

    return result;
  }

  async findAllByPatientAndClinic(patientId: string, clinicId: string): Promise<Appointment[]> {
    const snapshot = await this.collection
      .where('patientId', '==', patientId)
      .where('clinicId', '==', clinicId)
      .where('isDeleted', '==', false)
      .orderBy('date', 'desc')
      .orderBy('time', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
  }

  async findByPatientId(patientId: string): Promise<Appointment[]> {
    const snapshot = await this.collection
      .where('patientId', '==', patientId)
      // Note: Inequality filters on multiple properties require composite indexes,
      // so we fetch all and filter deleted in memory.
      .orderBy('date', 'desc')
      .orderBy('time', 'desc')
      .limit(50)
      .get();

    // Filter out deleted in memory to avoid composite index requirements right now
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
    return docs.filter(a => !a.isDeleted);
  }

  async findByPatientIds(patientIds: string[]): Promise<Appointment[]> {
    if (patientIds.length === 0) return [];
    
    // Firestore 'in' supports max 30 items
    const CHUNK_SIZE = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < patientIds.length; i += CHUNK_SIZE) {
      chunks.push(patientIds.slice(i, i + CHUNK_SIZE));
    }

    const snapshots = await Promise.all(
      chunks.map(chunk =>
        this.collection
          .where('patientId', 'in', chunk)
          .orderBy('date', 'desc')
          .limit(100)
          .get()
      )
    );

    const docs = snapshots.flatMap(snapshot => 
      snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment))
    );
    
    return docs.filter(a => !a.isDeleted);
  }

  async delete(id: string): Promise<void> {
    await this.collection.doc(id).update({
      isDeleted: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // ── Transaction & Locking Implementations ───────────────────────────────

  async runTransaction<T>(action: (transaction: ITransaction) => Promise<T>): Promise<T> {
    return db.runTransaction(async (t) => {
      return action(t);
    });
  }

  async createSlotLock(
    lockId: string,
    data: { appointmentId: string; doctorId: string; date: string; sessionIndex: number; slotIndex: number },
    transaction: ITransaction
  ): Promise<void> {
    const docRef = db.collection('slot-locks').doc(lockId);
    const t = transaction as admin.firestore.Transaction;
    // .create() fails atomically at the DB level if the document already exists
    t.create(docRef, {
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async releaseSlotLock(lockId: string, transaction?: ITransaction): Promise<void> {
    const docRef = db.collection('slot-locks').doc(lockId);
    if (transaction) {
      const t = transaction as admin.firestore.Transaction;
      t.delete(docRef);
    } else {
      await docRef.delete();
    }
  }

  /**
   * Atomically updates the session-level booked-count Firestore document.
   * MUST be called inside the same transaction as the appointment write.
   * delta = +1 for new bookings, -1 for cancellation/skip/no-show.
   */
  async updateBookedCount(
    clinicId: string,
    doctorId: string,
    date: string,
    sessionIndex: number,
    delta: 1 | -1,
    transaction: ITransaction
  ): Promise<void> {
    const safeDate = date.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const counterId = `${clinicId}_${doctorId}_${safeDate}_${sessionIndex}`;
    const counterRef = db.collection('session-booked-counts').doc(counterId);
    const t = transaction as admin.firestore.Transaction;

    // Use FieldValue.increment for a true atomic operation.
    // If the document doesn't exist, set() with merge will create it.
    t.set(counterRef, {
      clinicId,
      doctorId,
      date,
      sessionIndex,
      bookedCount: admin.firestore.FieldValue.increment(delta),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}
