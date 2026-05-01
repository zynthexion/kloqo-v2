import { User, PaginationParams, PaginatedResponse, KLOQO_ROLES } from '../../../../packages/shared/src/index';
import { IUserRepository } from '../../domain/repositories';
import { db, paginate } from './config';

export class FirebaseUserRepository implements IUserRepository {
  private collection = db.collection('users');

  async findAll(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<User> | User[]> {
    let query = this.collection
      .where('clinicId', '==', clinicId)
      .where('isDeleted', '==', false);

    if (params) {
      return paginate<User>(query, params);
    }

    // ✅ FINOPS: Added default limit to prevent unbounded fetch of users
    const snapshot = await query.limit(100).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  }

  async findById(id: string, clinicId: string): Promise<User | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data() as User;

    // SECURITY: IDOR Prevention. 'SYSTEM' is a reserved bypass for auth/internal lookups.
    if (clinicId !== 'SYSTEM' && (data.isDeleted === true || data.clinicId !== clinicId)) {
      console.warn(`[SECURITY_ALERT] Potential IDOR attempt: Clinic ${clinicId} tried to access User ${id}`);
      return null;
    }
    
    return { id: doc.id, ...data };
  }

  async findByPhone(phone: string, clinicId: string): Promise<User | null> {
    let query = this.collection.where('phone', '==', phone);
    
    if (clinicId !== 'SYSTEM') {
      query = query.where('clinicId', '==', clinicId);
    }

    const snapshot = await query.limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const user = { id: doc.id, ...doc.data() } as User;
    return user.isDeleted !== true ? user : null;
  }

  async findByEmail(email: string, clinicId: string): Promise<User | null> {
    let query = this.collection.where('email', '==', email);
    
    if (clinicId !== 'SYSTEM') {
      query = query.where('clinicId', '==', clinicId);
    }

    const snapshot = await query.limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const user = { id: doc.id, ...doc.data() } as User;
    return user.isDeleted !== true ? user : null;
  }

  async countByRole(role: string): Promise<number> {
    const snapshot = await this.collection.where('role', '==', role).where('isDeleted', '==', false).count().get();
    const data = snapshot.data();
    return data.count;
  }

  async save(user: User, clinicId: string, transaction?: ITransaction): Promise<void> {
    const { id, ...data } = user;
    const docRef = this.collection.doc(id!);
    const payload = {
      ...data,
      createdAt: data.createdAt || new Date(),
      updatedAt: new Date()
    };

    if (transaction) {
      (transaction as any).set(docRef, payload);
    } else {
      await docRef.set(payload);
    }
  }

  async update(id: string, clinicId: string, data: Partial<User>, transaction?: ITransaction): Promise<void> {
    const existing = await this.findById(id, clinicId);
    if (!existing) throw new Error('User not found or unauthorized');

    const docRef = this.collection.doc(id);
    const payload = {
      ...data,
      updatedAt: new Date()
    };

    if (transaction) {
      (transaction as any).update(docRef, payload);
    } else {
      await docRef.update(payload);
    }
  }

  async delete(id: string, clinicId: string, soft: boolean = true, transaction?: ITransaction): Promise<void> {
    const existing = await this.findById(id, clinicId);
    if (!existing) throw new Error('User not found or unauthorized');

    const docRef = this.collection.doc(id);
    if (soft) {
      const payload = {
        isDeleted: true,
        updatedAt: new Date()
      };
      if (transaction) {
        (transaction as any).update(docRef, payload);
      } else {
        await docRef.update(payload);
      }
    } else {
      if (transaction) {
        (transaction as any).delete(docRef);
      } else {
        await docRef.delete();
      }
    }
  }

  async findAdminsByClinicId(clinicId: string): Promise<User[]> {
    const snapshot = await this.collection
      .where('clinicId', '==', clinicId)
      .where('role', '==', KLOQO_ROLES.CLINIC_ADMIN)
      .where('isDeleted', '==', false)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  }

  async runTransaction<T>(action: (transaction: ITransaction) => Promise<T>): Promise<T> {
    return db.runTransaction(async (t) => {
      return action(t);
    });
  }
}
