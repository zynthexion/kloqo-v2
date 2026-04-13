import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * NORMALIZATION SCRIPT: Firestore Timestamps
 * 
 * This script iterates through all collections and converts "map-based" timestamps 
 * (e.g., { _seconds, _nanoseconds }) into real Firestore Timestamps.
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

function isTimestampMap(obj: any): boolean {
  return obj && typeof obj === 'object' && 
         (obj._seconds !== undefined || obj.seconds !== undefined) &&
         !obj.toDate; // Not already a Timestamp instance
}

function normalizeValue(value: any): any {
  if (value === null || typeof value !== 'object') return value;

  if (isTimestampMap(value)) {
    const seconds = value._seconds ?? value.seconds;
    const nanoseconds = value._nanoseconds ?? value.nanoseconds ?? 0;
    return new admin.firestore.Timestamp(seconds, nanoseconds);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  const normalized: any = {};
  for (const key in value) {
    normalized[key] = normalizeValue(value[key]);
  }
  return normalized;
}

async function normalizeCollection(collectionName: string) {
  console.log(`\n--- Normalizing collection: ${collectionName} ---`);
  
  const snapshot = await db.collection(collectionName).get();
  console.log(`Found ${snapshot.size} documents.`);

  const batchSize = 500;
  let batch = db.batch();
  let count = 0;
  let totalUpdated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const normalizedData = normalizeValue(data);
    
    // Check if anything actually changed (shallow comparison is hard, but we can check if normalizedData is different)
    // For simplicity, we'll just update all docs for now or do a deep check if needed.
    // In this case, since we want to be thorough, we update.
    
    batch.update(doc.ref, normalizedData);
    count++;
    totalUpdated++;

    if (count >= batchSize) {
      await batch.commit();
      console.log(`Updated ${totalUpdated} documents...`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Updated final ${count} documents.`);
  }

  console.log(`Done with ${collectionName}.`);
}

async function runNormalization() {
  const collections = [
    'appointments',
    'clinics',
    'patients',
    'users',
    'app_traffic',
    'marketing_analytics',
    'marketing_interactions',
    'whatsapp_sessions',
    'doctor_punctuality_logs',
    'error_logs',
    'notification-configs'
  ];

  console.log('Starting Firestore Data Normalization...');
  
  for (const coll of collections) {
    try {
      await normalizeCollection(coll);
    } catch (error) {
      console.error(`Failed to normalize ${coll}:`, error);
    }
  }

  console.log('\n=========================================');
  console.log('DATA NORMALIZATION COMPLETED');
  console.log('=========================================');
}

runNormalization();
