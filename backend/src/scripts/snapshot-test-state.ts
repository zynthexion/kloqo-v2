import { db } from '../infrastructure/firebase/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Snapshot Test State Tool
 * 
 * Captures the current state of a doctor's session for the Manual Verification Plan.
 * Usage: npm run snapshot <phase_name>
 */

async function captureSnapshot() {
  const phase = process.argv[2] || 'default';
  console.log(`📸 Capturing snapshot for phase: ${phase}...`);

  // Target collections for verification
  const collectionsToSnapshot = ['appointments', 'slot-locks', 'doctors'];
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotDir = path.join(__dirname, '../../test_results', phase, timestamp);

  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  try {
    for (const colName of collectionsToSnapshot) {
      const colRef = db.collection(colName);
      const snapshot = await colRef.get();
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const filePath = path.join(snapshotDir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`  ✅ Saved ${data.length} documents from ${colName}`);
    }

    const manifestPath = path.join(snapshotDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      phase,
      timestamp,
      capturedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    }, null, 2));

    console.log(`\n🎉 Snapshot saved to: ${snapshotDir}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Snapshot failed:', error);
    process.exit(1);
  }
}

captureSnapshot();
