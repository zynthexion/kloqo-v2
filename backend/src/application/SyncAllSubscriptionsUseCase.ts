import { db } from '../infrastructure/firebase/config';

export class SyncAllSubscriptionsUseCase {
  async execute(): Promise<{ totalProcessed: number }> {
    const now = new Date();
    
    // We only want to flip booleans for clinics that are STILL in trial status
    // but whose trialEndDate is in the past.
    const clinicsQuery = db.collection('clinics')
      .where('subscriptionDetails.isTrialPeriod', '==', true)
      .where('trialEndDate', '<', now);

    const snapshot = await clinicsQuery.get();
    if (snapshot.empty) {
      console.log('[SyncSubscriptions] No expired trials to sync.');
      return { totalProcessed: 0 };
    }

    // Firestore limits batches to 500 operations. We must chunk them.
    const batches: Promise<any>[] = [];
    let currentBatch = db.batch();
    let operationCount = 0;
    let totalProcessed = 0;

    snapshot.docs.forEach((doc) => {
      currentBatch.update(doc.ref, { 'subscriptionDetails.isTrialPeriod': false });
      operationCount++;
      totalProcessed++;

      if (operationCount === 499) {
        batches.push(currentBatch.commit());
        currentBatch = db.batch(); // Create a new fresh batch
        operationCount = 0;
      }
    });

    // Commit any lingering updates not reaching 499
    if (operationCount > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);
    
    console.log(`[SyncSubscriptions] ✅ Successfully expired trials for ${totalProcessed} clinics.`);
    return { totalProcessed };
  }
}
