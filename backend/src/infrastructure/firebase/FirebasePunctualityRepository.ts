import { IPunctualityRepository } from '../../domain/repositories';
import { PunctualityLog } from '../../../../packages/shared/src/index';
import { db } from './config';

export class FirebasePunctualityRepository implements IPunctualityRepository {
  private collectionPath = 'doctor_punctuality_logs';

  async findAll(clinicId: string): Promise<PunctualityLog[]> {
    const snapshot = await db.collection(this.collectionPath)
      .where('clinicId', '==', clinicId)
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();
      
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PunctualityLog));
  }

  async findByDoctorId(doctorId: string, clinicId: string): Promise<PunctualityLog[]> {
    const snapshot = await db.collection(this.collectionPath)
      .where('clinicId', '==', clinicId)
      .where('doctorId', '==', doctorId)
      .orderBy('timestamp', 'desc')
      .get();
      
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PunctualityLog));
  }
}
