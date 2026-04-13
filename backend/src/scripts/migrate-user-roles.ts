/**
 * ============================================================
 * KLOQO V2 — User Role Migration Script
 * ============================================================
 * PURPOSE: Permanently standardize legacy role strings in the
 *          Firestore 'users' collection to match KLOQO_ROLES.
 *
 * DUAL-SYSTEM UPDATE: Updates BOTH the Firestore document AND
 *          Firebase Auth Custom Claims simultaneously to prevent
 *          JWT desync (Custom Claims Trap).
 *
 * SAFE BATCHING: Processes in chunks of 400 to stay well under
 *          Firestore's hard 500-operation batch limit.
 *
 * DRY-RUN: Pass --dry-run flag to audit without committing.
 *          node -r ts-node/register scripts/migrate-user-roles.ts --dry-run
 *
 * LIVE RUN:
 *          node -r ts-node/register scripts/migrate-user-roles.ts
 * ============================================================
 */

import { KLOQO_ROLES, KloqoRole } from '@kloqo/shared';
import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const BATCH_SIZE = 400; // Safe buffer under the 500-op limit
const DRY_RUN = process.argv.includes('--dry-run');

// ─────────────────────────────────────────────────────────────
// Legacy Role Mapping (SSOT)
// Any string found here in the DB will be normalized to its
// canonical KLOQO_ROLES equivalent.
// ─────────────────────────────────────────────────────────────
const ROLE_MIGRATION_MAP: Record<string, KloqoRole> = {
  'admin':       KLOQO_ROLES.CLINIC_ADMIN,
  'super-admin': KLOQO_ROLES.SUPER_ADMIN,
  'superadmin':  KLOQO_ROLES.SUPER_ADMIN,
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function normalizeRole(role: string): KloqoRole | null {
  return ROLE_MIGRATION_MAP[role] ?? null;
}

function normalizeRoleArray(roles: any[]): KloqoRole[] {
  return roles.map(r => ROLE_MIGRATION_MAP[r] ?? r) as KloqoRole[];
}

// ─────────────────────────────────────────────────────────────
// Core Migration Logic
// ─────────────────────────────────────────────────────────────
async function migrateUserRoles() {
  console.log(`\n🚀 KLOQO Role Migration [${DRY_RUN ? '🟡 DRY RUN' : '🔴 LIVE'}]`);
  console.log('='.repeat(55));

  const legacyRoles = Object.keys(ROLE_MIGRATION_MAP);
  let totalFound = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  const failedUIDs: string[] = [];

  // Query each legacy role separately (Firestore doesn't support 'IN' on array fields)
  for (const legacyRole of legacyRoles) {
    console.log(`\n🔍 Scanning for users with role: '${legacyRole}'...`);

    const snapshot = await db.collection('users')
      .where('role', '==', legacyRole)
      .get();

    if (snapshot.empty) {
      console.log(`   ✅ No users found with role '${legacyRole}'.`);
      continue;
    }

    const usersToUpdate = snapshot.docs.map(doc => ({
      uid: doc.id,
      currentRole: doc.data().role as string,
      currentRoles: doc.data().roles as string[] | undefined,
      email: doc.data().email as string,
    }));

    totalFound += usersToUpdate.length;
    console.log(`   Found ${usersToUpdate.length} user(s) to migrate.`);

    // Process in chunks to respect the 500-op Firestore batch limit
    while (usersToUpdate.length > 0) {
      const chunk = usersToUpdate.splice(0, BATCH_SIZE);

      console.log(`\n   ⚙️  Processing chunk of ${chunk.length} user(s)...`);

      if (DRY_RUN) {
        // Dry run: just log what would happen
        for (const user of chunk) {
          const newRole = normalizeRole(user.currentRole)!;
          const newRoles = user.currentRoles
            ? normalizeRoleArray(user.currentRoles)
            : [newRole];
          console.log(`   [DRY RUN] UID ${user.uid} (${user.email || 'no-email'}): '${user.currentRole}' → '${newRole}'`);
          console.log(`             roles: [${(user.currentRoles || []).join(', ')}] → [${newRoles.join(', ')}]`);
        }
        totalUpdated += chunk.length;
        continue;
      }

      // LIVE RUN: Update Firestore in a batch first, then Custom Claims individually
      const batch = db.batch();

      for (const user of chunk) {
        const newRole = normalizeRole(user.currentRole)!;
        const newRoles = user.currentRoles
          ? normalizeRoleArray(user.currentRoles)
          : [newRole];

        const docRef = db.collection('users').doc(user.uid);
        batch.update(docRef, {
          role: newRole,
          roles: newRoles,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          _roleMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Commit the Firestore batch
      await batch.commit();
      console.log(`   ✅ Firestore batch committed for ${chunk.length} user(s).`);

      // Update Custom Claims individually (no bulk API in Firebase Admin SDK)
      // CRITICAL: This syncs the JWT metadata to prevent stale-token 403s
      for (const user of chunk) {
        const newRole = normalizeRole(user.currentRole)!;
        const newRoles = user.currentRoles
          ? normalizeRoleArray(user.currentRoles)
          : [newRole];

        try {
          await admin.auth().setCustomUserClaims(user.uid, {
            role: newRole,
            roles: newRoles,
          });
          console.log(`   ✅ Custom Claims updated: UID ${user.uid} (${user.email || 'no-email'}) → '${newRole}'`);
          totalUpdated++;
        } catch (err: any) {
          console.error(`   ❌ Failed Custom Claims for UID ${user.uid}: ${err.message}`);
          failedUIDs.push(user.uid);
          totalFailed++;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Final Report
  // ─────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(55));
  console.log(`📊 Migration Report [${DRY_RUN ? 'DRY RUN' : 'LIVE'}]`);
  console.log('='.repeat(55));
  console.log(`  Users Found:   ${totalFound}`);
  console.log(`  Users Updated: ${totalUpdated}`);
  console.log(`  Users Failed:  ${totalFailed}`);

  if (failedUIDs.length > 0) {
    console.warn('\n⚠️  The following UIDs failed Custom Claims update and may need manual remediation:');
    failedUIDs.forEach(uid => console.warn(`   - ${uid}`));
  }

  if (DRY_RUN) {
    console.log('\n🟡 DRY RUN complete. No data was modified. Remove --dry-run to execute.');
  } else {
    console.log('\n✅ Migration complete.');
    console.log('⚠️  Token TTL Notice: Active users may hold stale JWTs for up to 1 hour.');
    console.log('   If any user encounters a 403, ask them to log out and log back in.');
  }

  process.exit(0);
}

migrateUserRoles().catch(err => {
  console.error('[FATAL] Migration failed with unhandled error:', err);
  process.exit(1);
});
