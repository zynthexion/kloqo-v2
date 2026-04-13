import * as admin from 'firebase-admin';
import { Department, PaginationParams, PaginatedResponse } from '../../../../packages/shared/src/index';
import { IDepartmentRepository } from '../../domain/repositories';
import { paginate } from './config';

export class FirebaseDepartmentRepository implements IDepartmentRepository {
  private collection = admin.firestore().collection('master-departments');

  async findAll(params?: PaginationParams): Promise<Department[] | PaginatedResponse<Department>> {
    const query = this.collection.where('isDeleted', '==', false);
    return paginate<Department>(query, params);
  }

  async findById(id: string): Promise<Department | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Department;
  }

  async save(department: Department): Promise<void> {
    const { id, ...data } = department;
    if (id) {
      await this.collection.doc(id).set(data, { merge: true });
    } else {
      await this.collection.add({ 
        ...data, 
        isDeleted: false, 
        doctors: data.doctors || [],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  async update(id: string, department: Partial<Department>): Promise<void> {
    await this.collection.doc(id).update({
      ...department,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async delete(id: string, soft: boolean = true): Promise<void> {
    if (soft) {
      await this.collection.doc(id).update({ 
        isDeleted: true,
        deletedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await this.collection.doc(id).delete();
    }
  }
}
