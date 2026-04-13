import { User, PaginationParams, PaginatedResponse } from '../../../../packages/shared/src/index';
import { IUserRepository } from '../../domain/repositories';
import { db, paginate } from './config';

export class FirebaseUserRepository implements IUserRepository {
  private collection = db.collection('users');

  async findAll(params?: PaginationParams): Promise<PaginatedResponse<User> | User[]> {
    let query = this.collection.where('isDeleted', '==', false);

    if (params?.clinicId) {
      query = query.where('clinicId', '==', params.clinicId);
    }

    if (params) {
      return paginate<User>(query, params);
    }

    // ✅ FINOPS: Added default limit to prevent unbounded fetch of users
    const snapshot = await query.limit(100).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  }

  async findById(id: string): Promise<User | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists || (doc.data() as any).isDeleted === true) return null;
    return { id: doc.id, ...doc.data() } as User;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const snapshot = await this.collection.where('phone', '==', phone).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const user = { id: doc.id, ...doc.data() } as User;
    return user.isDeleted !== true ? user : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const snapshot = await this.collection.where('email', '==', email).limit(1).get();
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

  async save(user: User): Promise<void> {
    const { id, ...data } = user;
    await this.collection.doc(id!).set({
      ...data,
      createdAt: data.createdAt || new Date(),
      updatedAt: new Date()
    });
  }

  async update(id: string, data: Partial<User>): Promise<void> {
    await this.collection.doc(id).update({
      ...data,
      updatedAt: new Date()
    });
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

  async findAdminsByClinicId(clinicId: string): Promise<User[]> {
    const snapshot = await this.collection
      .where('clinicId', '==', clinicId)
      .where('role', '==', 'clinicAdmin')
      .where('isDeleted', '==', false)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  }
}
