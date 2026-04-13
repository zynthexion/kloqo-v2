import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

/**
 * MIGRATION SCRIPT: Legacy Data Recovery (isDeleted field)
 * 
 * This script iterates through all major collections and adds 'isDeleted: false'
 * to any document that doesn't have it. This is required because the V2 Backend
 * uses a '.where("isDeleted", "!=", true)' filter which excludes docs where the field is missing.
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

const collectionsToMigrate = [
  'patients',
  'clinics',
  'doctors',
  'users',
  'appointments',
  'master-departments', // Maps to departments
  'whatsapp_sessions'
];

async function migrateCollection(collectionName: string) {
  console.log(`\n--- Migrating collection: ${collectionName} ---`);
  const collectionRef = db.collection(collectionName);
  
  // Find all documents where isDeleted is MISSING
  // Note: Firestore doesn't have a "field exists" operator, 
  // so we have to fetch and check in memory OR fetch batches.
  // We'll fetch in batches of 500 for safety.
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  
  const snapshot = await collectionRef.get();
  console.log(`Found ${snapshot.size} total documents in ${collectionName}`);

  const batchSize = 500;
  let batch = db.batch();
  let countInBatch = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    totalProcessed++;

    if (data.isDeleted === undefined) {
      batch.update(doc.ref, { isDeleted: false });
      countInBatch++;
      totalUpdated++;

      if (countInBatch >= batchSize) {
        await batch.commit();
        console.log(`Committed batch of ${countInBatch} updates...`);
        batch = db.batch();
        countInBatch = 0;
      }
    }
  }

  if (countInBatch > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${countInBatch} updates.`);
  }

  console.log(`Migration Complete for ${collectionName}:`);
  console.log(`- Total Docs Checked: ${totalProcessed}`);
  console.log(`- Total Docs Updated: ${totalUpdated}`);
}

async function runMigration() {
  console.log('Starting Legacy Data Migration...');
  
  try {
    for (const collection of collectionsToMigrate) {
      await migrateCollection(collection);
    }
    console.log('\n=========================================');
    console.log('ALL MIGRATIONS COMPLETED SUCCESSFULLY');
    console.log('=========================================');
  } catch (error) {
    console.error('Migration Failed:', error);
    process.exit(1);
  }
}

runMigration();
