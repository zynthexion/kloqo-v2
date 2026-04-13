import { db } from './backend/src/infrastructure/firebase/config';
import { SyncAllSubscriptionsUseCase } from './backend/src/application/SyncAllSubscriptionsUseCase';

async function verifyTrialSync() {
  console.log('--- STARTING TRIAL SYNC VERIFICATION ---');

  // 1. Setup Mock Clinics
  const batch = db.batch();
  const testIds = [];
  
  for (let i = 0; i < 3; i++) {
    const ref = db.collection('clinics').doc(`test_clinic_${Date.now()}_${i}`);
    testIds.push(ref.id);
    
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2); // 2 days ago = EXPIRED

    batch.set(ref, {
      trialEndDate: pastDate,
      subscriptionDetails: {
        isTrialPeriod: true
      }
    });
  }
  
  // Create one active trial
  const activeRef = db.collection('clinics').doc(`test_clinic_active_${Date.now()}`);
  testIds.push(activeRef.id);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 20);
  
  batch.set(activeRef, {
    trialEndDate: futureDate,
    subscriptionDetails: {
        isTrialPeriod: true
    }
  });

  await batch.commit();
  console.log(`✅ Created 3 expired mock clinics and 1 active mock clinic.`);

  // 2. Run Sync
  console.log('🔄 Executing SyncAllSubscriptionsUseCase...');
  const useCase = new SyncAllSubscriptionsUseCase();
  const result = await useCase.execute();

  console.log(`✅ Use Case reported: ${result.totalProcessed} clinics processed.`);

  // 3. Verify database state
  console.log('🔍 Verifying document state...');
  
  const verifyDocs = await db.collection('clinics').get(); // Since we just created them, we know they exist. Let's just loop the IDs directly.
  
  for (const docId of testIds) {
      const docSnap = await db.collection('clinics').doc(docId).get();
      const isTrial = docSnap.data()?.subscriptionDetails?.isTrialPeriod;
      console.log(`   📝 ${docId}: isTrialPeriod = ${isTrial}`);
      
      // Cleanup
      await docSnap.ref.delete();
  }

  console.log('🧹 Cleaned up mock data.');
  console.log('--- VERIFICATION COMPLETE ---');
}

verifyTrialSync()
  .then(() => process.exit(0))
  .catch(console.error);
