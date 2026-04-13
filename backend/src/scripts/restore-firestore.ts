import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

/**
 * RESTORE SCRIPT: Firebase Firestore (V2 Golden Standard Edition)
 * 
 * This script reads JSON backup files (after running standardize-times.ts) 
 * and writes them to the configured Firestore instance.
 * 
 * Key improvement: convertTimestamps() converts { _seconds, _nanoseconds } maps
 * into native admin.firestore.Timestamp in-flight, making normalize-timestamps.ts redundant.
 * 
 * Usage: npx ts-node src/scripts/restore-firestore.ts <backup_directory_path>
 * Example: npx ts-node src/scripts/restore-firestore.ts ../backups/2026-03-17T16-43-28-472Z
 */

const backupDir = process.argv[2];

if (!backupDir) {
  console.error('Error: Please provide the path to the backup directory.');
  console.error('Example: npx ts-node src/scripts/restore-firestore.ts ../backups/2026-03-17T16-43-28-472Z');
  process.exit(1);
}

const absoluteBackupDir = path.resolve(process.cwd(), backupDir);

if (!fs.existsSync(absoluteBackupDir)) {
  console.error(`Error: Backup directory not found at ${absoluteBackupDir}`);
  process.exit(1);
}

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

/**
 * Recursively convert { _seconds, _nanoseconds } JSON maps into native Firestore Timestamps.
 * Eliminates the need for the separate normalize-timestamps.ts post-migration step.
 */
function convertTimestamps(data: any): any {
  if (data === null || data === undefined) return data;

  if (typeof data === 'object' && !Array.isArray(data)) {
    const seconds = data._seconds ?? data.seconds;
    const nanoseconds = data._nanoseconds ?? data.nanoseconds ?? 0;
    // Detect Timestamp-shaped objects: must have seconds and at most 2 keys
    if (typeof seconds === 'number' && Object.keys(data).length <= 2) {
      return new admin.firestore.Timestamp(seconds, nanoseconds);
    }
    // Recursively process nested objects
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, convertTimestamps(v)])
    );
  }

  if (Array.isArray(data)) {
    return data.map(convertTimestamps);
  }

  return data;
}

async function restoreCollection(filePath: string) {
  const collectionName = path.basename(filePath, '.json');
  console.log(`\n--- Restoring collection: ${collectionName} ---`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  const raw = JSON.parse(content);
  
  // Support both array format ([{ id, ...data }]) and object map format ({ docId: { ...data } })
  const items: { id: string; [key: string]: any }[] = Array.isArray(raw)
    ? raw
    : Object.entries(raw).map(([id, data]: [string, any]) => ({ id, ...data }));

  console.log(`Found ${items.length} documents to restore.`);

  const batchSize = 450; // Safe under Firestore's 500-op limit
  let batch = db.batch();
  let count = 0;
  let totalRestored = 0;

  for (const item of items) {
    const { id, ...data } = item;
    if (!id && !data.uid) {
      console.warn(`Warning: Skipping document without ID in ${collectionName}`);
      continue;
    }
    let docId = id;
    
    // SPECIAL LOGIC FOR USERS: Prioritize Firebase UID as the Document ID
    if (collectionName === 'users') {
      if (data.uid) {
        docId = data.uid;
      } else if (id.length > 20 && /^[A-Za-z0-9]{20,}$/.test(id)) {
        // If the key itself looks like a UID, keep it
        docId = id;
      } else if (data.id && data.id.length > 20) {
        docId = data.id;
      }
    }

    const docRef = db.collection(collectionName).doc(docId);
    // Convert all { _seconds, _nanoseconds } maps to native Timestamps in-flight
    batch.set(docRef, convertTimestamps(data));
    count++;
    totalRestored++;

    if (count >= batchSize) {
      await batch.commit();
      console.log(`Committed batch of ${count} documents...`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${count} documents.`);
  }

  console.log(`Successfully restored ${totalRestored} documents to ${collectionName}.`);
}

async function runRestore() {
  console.log('Starting Firestore Restoration...');
  console.log(`Target Project: ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`Source Directory: ${absoluteBackupDir}`);
  
  try {
    const files = fs.readdirSync(absoluteBackupDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      await restoreCollection(path.join(absoluteBackupDir, file));
    }
    
    console.log('\n=========================================');
    console.log('ALL COLLECTIONS RESTORED SUCCESSFULLY');
    console.log('=========================================');
  } catch (error) {
    console.error('Restoration Failed:', error);
    process.exit(1);
  }
}

runRestore();
