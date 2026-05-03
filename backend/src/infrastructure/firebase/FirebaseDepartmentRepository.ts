import * as admin from 'firebase-admin';
import { Department, PaginationParams, PaginatedResponse } from '../../../../packages/shared/src/index';
import { IDepartmentRepository } from '../../domain/repositories';
import { paginate } from './config';

export class FirebaseDepartmentRepository implements IDepartmentRepository {
  private collection = admin.firestore().collection('master-departments');

  async findAll(clinicId: string, params?: PaginationParams): Promise<Department[] | PaginatedResponse<Department>> {
    const query = this.collection.where('isDeleted', '==', false);
    // Note: clinicId is currently ignored as departments are global-lookup, 
    // but the parameter is required for interface compliance.
    return paginate<Department>(query, params);
  }

  async findById(id: string, clinicId: string): Promise<Department | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Department;
  }

  async save(department: Department, _clinicId: string): Promise<void> {
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

  async update(id: string, _clinicId: string, department: Partial<Department>): Promise<void> {
    await this.collection.doc(id).update({
      ...department,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  async delete(id: string, _clinicId: string, soft: boolean = true): Promise<void> {
    if (soft) {
      await this.collection.doc(id).update({ 
        isDeleted: true,
        deletedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await this.collection.doc(id).delete();
    }
  }

  async countAll(clinicId: string): Promise<number> {
    const snapshot = await this.collection
      .where('isDeleted', '==', false)
      .count()
      .get();
    return snapshot.data().count;
  }

  async countByClinicId(clinicId: string): Promise<number> {
    return this.countAll(clinicId);
  }
}
