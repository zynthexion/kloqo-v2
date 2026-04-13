import * as path from 'path';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { KLOQO_ROLES } from '../../../packages/shared/src/index';

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * DOCTOR ROLE NORMALIZATION (PHASE 9)
 * 
 * This script:
 * 1. Scans the 'doctors' collection for legacy 'role' and 'roles' fields.
 * 2. Synchronizes these roles to the authoritative 'users' collection (matched by email).
 * 3. Removes the redundant 'role' and 'roles' fields from the 'doctors' documents.
 */

// --- CONFIGURATION ---
const DRY_RUN = true; // SET TO FALSE TO EXECUTE ACTUAL WRITES
const BATCH_LIMIT = 400; // Chunked for production safety
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

async function normalizeDoctorRoles() {
  console.log('====================================================');
  console.log('🚀 DOCTOR ROLE NORMALIZATION (PHASE 9)');
  console.log(`MODE: ${DRY_RUN ? '🛑 DRY RUN (NO WRITES)' : '🔥 LIVE EXECUTION'}`);
  console.log('====================================================\n');

  try {
    const doctorsCollection = db.collection('doctors');
    const usersCollection = db.collection('users');
    const doctorsSnapshot = await doctorsCollection.get();

    console.log(`Scanned ${doctorsSnapshot.size} doctors...\n`);

    let totalScanned = 0;
    let totalMoved = 0;
    let totalCleaned = 0;
    let currentBatchCount = 0;
    let batch = db.batch();

    for (const doc of doctorsSnapshot.docs) {
      totalScanned++;
      const doctorData = doc.data();
      const docRoles = doctorData.roles;
      const docRole = doctorData.role;
      const docEmail = doctorData.email;

      // Check if this doctor document contains role data that needs moving or cleaning
      const hasRedundantRoles = docRoles || docRole;

      if (hasRedundantRoles && docEmail) {
        // Find associated user
        const userQuery = await usersCollection.where('email', '==', docEmail).limit(1).get();
        if (!userQuery.empty) {
          const userDoc = userQuery.docs[0];
          const userData = userDoc.data();
          
          // Determine final roles for the user
          const finalRoles = Array.from(new Set([
            KLOQO_ROLES.DOCTOR, 
            ...(docRoles || []), 
            ...(userData.roles || []),
            (docRole ? docRole : KLOQO_ROLES.DOCTOR)
          ]));

          if (DRY_RUN) {
            console.log(`[DRY RUN] Would sync roles for user ${docEmail}: ${JSON.stringify(finalRoles)}`);
          } else {
            // Update User
            batch.update(userDoc.ref, { 
              roles: finalRoles,
              role: KLOQO_ROLES.DOCTOR // Authoritative role for doctor personnel
            });
            currentBatchCount++;
          }
          totalMoved++;
        }

        if (DRY_RUN) {
          console.log(`[DRY RUN] Would remove roles/role from doctor doc ${doc.id} (${doctorData.name})`);
        } else {
          // Remove from Doctor
          batch.update(doc.ref, {
            roles: admin.firestore.FieldValue.delete(),
            role: admin.firestore.FieldValue.delete()
          });
          currentBatchCount++;
        }
        totalCleaned++;

        // Commit batch if we hit the limit
        if (!DRY_RUN && currentBatchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`✅ Committed batch.`);
          batch = db.batch();
          currentBatchCount = 0;
        }
      }
    }

    // Commit final batch
    if (!DRY_RUN && currentBatchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch.`);
    }

    console.log('\n====================================================');
    console.log('🏆 NORMALIZATION SUMMARY');
    console.log('====================================================');
    console.log(`Doctors Scanned:     ${totalScanned}`);
    console.log(`User Identities Updated: ${totalMoved}`);
    console.log(`Doctor Profiles Cleaned: ${totalCleaned}`);
    console.log('====================================================');

  } catch (error) {
    console.error('\n❌ NORMALIZATION FAILED:', error);
    process.exit(1);
  }
}

normalizeDoctorRoles().then(() => process.exit(0));
