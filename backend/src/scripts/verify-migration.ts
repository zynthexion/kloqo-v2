import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

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

const collectionsToCheck = [
  'appointments',
  'clinics',
  'doctors',
  'users',
  'patients'
];

async function getSample(collectionName: string) {
  console.log(`\n--- Sampling collection: ${collectionName} ---`);
  const snapshot = await db.collection(collectionName).limit(1).get();
  
  if (snapshot.empty) {
    console.log(`  No documents found in ${collectionName}.`);
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  
  // Format timestamps for readability in terminal
  const formattedData = JSON.parse(JSON.stringify(data, (key, value) => {
    if (value instanceof admin.firestore.Timestamp) {
        return value.toDate().toISOString() + ' (Native Timestamp)';
    }
    return value;
  }, 2));

  console.log(JSON.stringify({ id: doc.id, ...formattedData }, null, 2));
  return { id: doc.id, ...formattedData };
}

async function run() {
  console.log('==============================================');
  console.log('MIGRATION VERIFICATION: SAMPLE DATA');
  console.log(`PROJECT: ${process.env.FIREBASE_PROJECT_ID}`);
  console.log('==============================================');

  const results: any = {};
  for (const col of collectionsToCheck) {
    results[col] = await getSample(col);
  }

  console.log('\n==============================================');
  console.log('VERIFICATION COMPLETE');
  console.log('==============================================');
}

run().catch(console.error);
