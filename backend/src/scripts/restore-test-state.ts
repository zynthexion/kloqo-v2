import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Restore Test State Tool
 * 
 * Restores a doctor's session state from a captured snapshot.
 * Usage: npx ts-node src/scripts/restore-test-state.ts <snapshot_path>
 */

function convertTimestamps(data: any): any {
  if (data === null || typeof data !== 'object') return data;
  
  if ('_seconds' in data && '_nanoseconds' in data && Object.keys(data).length === 2) {
    return new admin.firestore.Timestamp(data._seconds, data._nanoseconds);
  }
  
  if (Array.isArray(data)) {
    return data.map(convertTimestamps);
  }
  
  const result: any = {};
  for (const key in data) {
    result[key] = convertTimestamps(data[key]);
  }
  return result;
}

async function restoreSnapshot() {
  const snapshotPath = process.argv[2];
  if (!snapshotPath) {
    console.error('❌ Please provide a snapshot path. Example: test_results/before_break(ten A no W)/2026-05-05T11-47-26-026Z');
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(snapshotPath) 
    ? snapshotPath 
    : path.join(__dirname, '../../', snapshotPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Snapshot path not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`⏳ Restoring snapshot from: ${absolutePath}...`);

  const collections = ['appointments', 'slot-locks', 'doctors'];

  try {
    for (const colName of collections) {
      const filePath = path.join(absolutePath, `${colName}.json`);
      if (!fs.existsSync(filePath)) {
        console.warn(`  ⚠️ Skipping ${colName}: file not found.`);
        continue;
      }

      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const colRef = db.collection(colName);

      // 1. Delete current documents in collection
      console.log(`  🗑️ Clearing collection: ${colName}...`);
      const existingDocs = await colRef.get();
      const batch = db.batch();
      existingDocs.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // 2. Load documents from snapshot
      console.log(`  📥 Loading ${rawData.length} documents into ${colName}...`);
      const writeBatch = db.batch();
      rawData.forEach((docData: any) => {
        const { id, ...rest } = docData;
        const cleanData = convertTimestamps(rest);
        writeBatch.set(colRef.doc(id), cleanData);
      });
      await writeBatch.commit();
      console.log(`  ✅ Restored ${colName}`);
    }

    console.log(`\n🎉 Restore complete!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

restoreSnapshot();
