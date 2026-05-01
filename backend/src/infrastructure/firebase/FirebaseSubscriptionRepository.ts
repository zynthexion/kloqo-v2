import { db } from './config';
import { ISubscriptionRepository } from '../../domain/repositories';
import { Subscription } from '../../../../packages/shared/src/index';

export class FirebaseSubscriptionRepository implements ISubscriptionRepository {
  private collection = db.collection('subscriptions');

  async findByClinicId(clinicId: string): Promise<Subscription | null> {
    const snap = await this.collection.where('clinicId', '==', clinicId).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as Subscription;
  }

  async findByRazorpaySubscriptionId(razorpaySubscriptionId: string): Promise<Subscription | null> {
    const snap = await this.collection
      .where('razorpaySubscriptionId', '==', razorpaySubscriptionId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as Subscription;
  }

  async save(subscription: Omit<Subscription, 'id'>): Promise<Subscription> {
    const ref = await this.collection.add({
      ...subscription,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id: ref.id, ...subscription };
  }

  async update(id: string, clinicId: string, data: Partial<Subscription>): Promise<void> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) throw new Error('Subscription not found');
    const existingData = doc.data() as Subscription;

    // SECURITY: IDOR Prevention.
    if (clinicId !== 'SYSTEM' && existingData.clinicId !== clinicId) {
      console.warn(`[SECURITY_ALERT] Potential IDOR attempt: Clinic ${clinicId} tried to update Subscription ${id}`);
      throw new Error('Unauthorized');
    }

    await docRef.update({ ...data, updatedAt: new Date() });
  }

  async getAll(): Promise<Subscription[]> {
    const snap = await this.collection.get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription));
  }

  async countByStatus(status: string): Promise<number> {
    const snap = await this.collection.where('status', '==', status).count().get();
    return snap.data().count;
  }

  async sumMRR(): Promise<number> {
    // Sum plans for all active subscriptions, parse value from planId like "₹1999"
    const snap = await this.collection.where('status', '==', 'active').get();
    return snap.docs.reduce((total, doc) => {
      const data = doc.data();
      const planId: string = data.planId || '0';
      const value = parseInt(planId.replace(/[^0-9]/g, ''), 10) || 0;
      return total + value;
    }, 0);
  }
}
