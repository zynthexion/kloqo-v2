import { IConsultationCounterRepository } from '../../domain/repositories';
import { db } from './config';
import { FieldValue } from 'firebase-admin/firestore';

export class FirebaseConsultationCounterRepository implements IConsultationCounterRepository {
  private collectionPath = 'consultation-counters';

  private getCounterId(clinicId: string, doctorId: string, date: string, sessionIndex: number): string {
    return `${clinicId}_${doctorId}_${date}_${sessionIndex}`.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  }

  async getCount(clinicId: string, doctorId: string, date: string, sessionIndex: number): Promise<number> {
    const counterId = this.getCounterId(clinicId, doctorId, date, sessionIndex);
    const counterDoc = await db.collection(this.collectionPath).doc(counterId).get();

    if (counterDoc.exists) {
      return counterDoc.data()?.count || 0;
    }

    return 0;
  }

  async increment(clinicId: string, doctorId: string, date: string, sessionIndex: number): Promise<void> {
    const counterId = this.getCounterId(clinicId, doctorId, date, sessionIndex);
    const counterRef = db.collection(this.collectionPath).doc(counterId);

    try {
      const counterDoc = await counterRef.get();
      if (!counterDoc.exists) {
        await counterRef.set({
          clinicId,
          doctorId,
          date,
          sessionIndex,
          count: 1,
          lastUpdated: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        });
      } else {
        await counterRef.update({
          count: FieldValue.increment(1),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error incrementing consultation counter:', error);
      throw error;
    }
  }
}
