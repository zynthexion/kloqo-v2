import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * CLEAR-FIRESTORE SCRIPT
 * 
 * Purpose: Completely purge the destination Firestore collections before restoration.
 * Target: The project defined in .env (NEW/DUP project).
 * 
 * WARNING: THIS IS DESTRUCTIVE. USE ONLY ON THE DUPLICATE/TEST ENIVRONMENT.
 */

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const collectionsToClear = [
  'app_traffic',
  'appointments',
  'campaign_sends',
  'campaign_summaries',
  'clinics',
  'consultation-counters',
  'doctor_punctuality_logs',
  'doctors',
  'error_logs',
  'magic_links',
  'marketing_analytics',
  'marketing_interactions',
  'master-departments',
  'patients',
  'reviews',
  'slot-reservations',
  'system-config',
  'token-counters',
  'users',
  'whatsapp_sessions'
];

async function deleteCollection(collectionName: string) {
  console.log(`\n--- Clearing collection: ${collectionName} ---`);
  const collectionRef = db.collection(collectionName);
  const snapshot = await collectionRef.get();
  
  if (snapshot.empty) {
    console.log(`  Collection is already empty.`);
    return;
  }

  const batchSize = 450;
  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;

    if (count >= batchSize) {
      await batch.commit();
      console.log(`  Deleted ${count} documents...`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`  Deleted final ${count} documents.`);
  }

  console.log(`✔ Finished clearing ${collectionName}.`);
}

async function run() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  console.log('==============================================');
  console.log('⚠️  FIRESTORE PURGE SCRIPT ⚠️');
  console.log(`TARGET PROJECT: ${projectId}`);
  console.log('==============================================');

  // Safety check: Don't clear if project ID doesn't contain 'dup' or 'test' (optional but good)
  // if (!projectId?.includes('dup') && !projectId?.includes('test')) {
  //     console.error('ERROR: This project does not look like a duplicate/test project. Refusing to clear.');
  //     process.exit(1);
  // }

  for (const col of collectionsToClear) {
    await deleteCollection(col);
  }

  console.log('\n==============================================');
  console.log('✅ ALL COLLECTIONS PURGED SUCCESSFULLY');
  console.log('==============================================');
}

run().catch(error => {
  console.error('Purge Failed:', error);
  process.exit(1);
});
