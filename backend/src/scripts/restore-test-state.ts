import { db } from '../infrastructure/firebase/config';
import * as fs from 'fs';
import * as path from 'path';

async function restoreSnapshot() {
  const snapshotDir = process.argv[2];
  if (!snapshotDir) {
    console.error('❌ Please provide the snapshot directory path.');
    process.exit(1);
  }

  console.log(`🔄 Restoring snapshot from: ${snapshotDir}...`);

  const collections = ['doctors', 'appointments', 'slot-locks'];

  try {
    // 1. CLEANUP: Delete ALL existing appointments and slot-locks for the target doctor
    const doctorId = 'doc-1776757867561';

    console.log(`🧹 Cleaning up ALL existing data for ${doctorId}...`);
    
    for (const colName of ['appointments', 'slot-locks']) {
      const snapshot = await db.collection(colName)
        .where('doctorId', '==', doctorId)
        .get();
      
      if (snapshot.empty) continue;
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`  🗑️ Deleted ${snapshot.size} existing documents from ${colName}`);
    }

    // 2. RESTORE
    for (const colName of collections) {
      const filePath = path.join(snapshotDir, `${colName}.json`);
      if (!fs.existsSync(filePath)) continue;

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`  📦 Processing ${data.length} documents for ${colName}...`);

      if (colName === 'appointments' || colName === 'slot-locks') {
        // Clear existing for this doctor/date to avoid duplicates
        // Note: In a real restore, you might want to be more surgical
        // For this test, we just push everything in the file
      }

      const batch = db.batch();
      let count = 0;

      for (const item of data) {
        const { id, ...docData } = item;
        const docRef = db.collection(colName).doc(id);
        
        // Handle Firestore Timestamps if they are in { _seconds, _nanoseconds } format
        const cleanData = JSON.parse(JSON.stringify(docData), (key, value) => {
          if (value && typeof value === 'object' && '_seconds' in value) {
            return new Date(value._seconds * 1000);
          }
          return value;
        });

        batch.set(docRef, cleanData, { merge: true });
        count++;

        if (count === 500) {
          await batch.commit();
          console.log(`    ✅ Committed batch of 500 for ${colName}`);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
        console.log(`    ✅ Committed final batch for ${colName}`);
      }
    }

    console.log('\n🎉 Database restore completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

restoreSnapshot();
