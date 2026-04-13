import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * MIGRATION SCRIPT (PHASE 5): Role to Roles[] Migration
 * 
 * This script normalizes the 'users' collection by mapping the existing 'role' (string) 
 * to the new 'roles' (string[]) property for all users.
 */

// --- CONFIGURATION ---
const DRY_RUN = true; // SET TO FALSE TO EXECUTE ACTUAL WRITES
const BATCH_LIMIT = 499; // Firestore batch limit is 500
// ---------------------

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

async function migrateRoles() {
  console.log('====================================================');
  console.log('🚀 INITIALIZING ROLE-TO-ARRAY MIGRATION (PHASE 5)');
  console.log(`MODE: ${DRY_RUN ? '🛑 DRY RUN (NO WRITES)' : '🔥 LIVE EXECUTION'}`);
  console.log('====================================================\n');

  try {
    const usersCollection = db.collection('users');
    const snapshot = await usersCollection.get();

    console.log(`Scanned ${snapshot.size} users...\n`);

    let totalScanned = 0;
    let totalUpgraded = 0;
    let totalSkipped = 0;
    let currentBatchCount = 0;
    let batch = db.batch();
    let batchesCommitted = 0;

    for (const doc of snapshot.docs) {
      totalScanned++;
      const data = doc.data();
      const legacyRole = data.role;
      const existingRoles = data.roles;

      // Logic: Only upgrade if 'roles' is missing/empty/not an array, 
      // and we have a valid 'role' string to map from.
      const needsUpgrade = legacyRole && (!existingRoles || !Array.isArray(existingRoles) || existingRoles.length === 0);

      if (needsUpgrade) {
          const upgradePayload = {
            roles: [legacyRole]
          };

          if (DRY_RUN) {
            console.log(`[DRY RUN] Would upgrade user ${doc.id} (${data.name || data.email}): roles: ['${legacyRole}']`);
          } else {
            batch.update(doc.ref, upgradePayload);
            currentBatchCount++;
          }

          totalUpgraded++;

          // Commit batch if we hit the limit
          if (!DRY_RUN && currentBatchCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log(`✅ Committed batch of ${currentBatchCount} updates.`);
            batchesCommitted++;
            batch = db.batch();
            currentBatchCount = 0;
          }
      } else {
        totalSkipped++;
      }
    }

    // Commit final batch if any operations remain
    if (!DRY_RUN && currentBatchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${currentBatchCount} updates.`);
      batchesCommitted++;
    }

    console.log('\n====================================================');
    console.log('🏆 MIGRATION SUMMARY REPORT');
    console.log('====================================================');
    console.log(`Scanned:           ${totalScanned}`);
    console.log(`Upgraded:          ${totalUpgraded}`);
    console.log(`Skipped:           ${totalSkipped}`);
    console.log(`Batches Committed: ${batchesCommitted}`);
    console.log('====================================================');

    if (DRY_RUN) {
      console.log('\n💡 Tip: To commit these changes, set DRY_RUN = false in the script.');
    }

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);
    process.exit(1);
  }
}

migrateRoles().then(() => {
  console.log('\nDone.');
  process.exit(0);
});
