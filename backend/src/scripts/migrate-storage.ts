/**
 * ============================================================
 * KLOQO V2 — Storage Migration Script
 * ============================================================
 * PURPOSE: Securely copy assets (avatars, logos, documents) 
 *          from the LEGACY Firebase Storage bucket to the 
 *          new V2 project without modifying the source.
 *
 * USAGE:
 *   Audit Only (Recommended):
 *   npx ts-node src/scripts/migrate-storage.ts --dry-run
 *
 *   Live Copy:
 *   npx ts-node src/scripts/migrate-storage.ts
 *
 *   Target Specific Folder:
 *   npx ts-node src/scripts/migrate-storage.ts --prefix clinics/
 * ============================================================
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

// ─────────────────────────────────────────────────────────────
// 1. CONFIGURATION
// ─────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const PREFIX = process.argv.find(arg => arg.startsWith('--prefix='))?.split('=')[1] || '';
const LEGACY_KEY_PATH = path.join(__dirname, '../../old_service_account.json');

// ─────────────────────────────────────────────────────────────
// 2. INITIALIZATION
// ─────────────────────────────────────────────────────────────

// Initialize V2 (Destination) App - uses default environment config
const destConfig = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
if (destConfig.private_key) {
  destConfig.private_key = destConfig.private_key.replace(/\\n/g, '\n');
}

const destApp = admin.apps.length 
  ? admin.app() 
  : admin.initializeApp({
      credential: admin.credential.cert(destConfig),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'kloqo-nurse-dup-43384903-8d386.firebasestorage.app'
    }, 'destination');

const destBucket = admin.storage(destApp).bucket();

// Initialize Legacy (Source) App
if (!fs.existsSync(LEGACY_KEY_PATH)) {
  console.error(`❌ Legacy service account not found at: ${LEGACY_KEY_PATH}`);
  process.exit(1);
}

const legacyConfig = JSON.parse(fs.readFileSync(LEGACY_KEY_PATH, 'utf8'));
if (legacyConfig.private_key) {
  legacyConfig.private_key = legacyConfig.private_key.replace(/\\n/g, '\n');
}

const legacyApp = admin.initializeApp({
  credential: admin.credential.cert(legacyConfig),
  storageBucket: `${legacyConfig.project_id}.firebasestorage.app` // Common default
}, 'legacy');

const sourceBucket = admin.storage(legacyApp).bucket();

// ─────────────────────────────────────────────────────────────
// 3. MIGRATION LOGIC
// ─────────────────────────────────────────────────────────────

async function migrateStorage() {
  console.log(`\n📦 KLOQO Storage Migration [${DRY_RUN ? '🟡 DRY RUN' : '🔴 LIVE'}]`);
  console.log('='.repeat(60));
  console.log(`Source:      ${sourceBucket.name}`);
  console.log(`Destination: ${destBucket.name}`);
  console.log(`Filter:      ${PREFIX || 'None (Total Sync)'}`);
  console.log('='.repeat(60));

  try {
    // 1. List files from source
    console.log(`🔍 Scanning source bucket...`);
    const [files] = await sourceBucket.getFiles({ prefix: PREFIX });

    if (files.length === 0) {
      console.log(`✅ No files found matching prefix: '${PREFIX}'`);
      process.exit(0);
    }

    console.log(`   Found ${files.length} file(s) to process.\n`);

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (const file of files) {
      const fileName = file.name;

      // Skip directories (ending in /)
      if (fileName.endsWith('/')) {
        skipCount++;
        continue;
      }

      const destFile = destBucket.file(fileName);

      if (DRY_RUN) {
        console.log(`   [DRY RUN] Would copy: ${fileName}`);
        successCount++;
        continue;
      }

      try {
        // CROSS-PROJECT SECURE TRANSFER:
        // Download from source using source credentials, then upload to dest using dest credentials.
        // This avoids cross-project IAM permission issues with bucket.copy().
        const [buffer] = await file.download();
        
        await destFile.save(buffer, {
          metadata: {
            contentType: file.metadata.contentType || 'application/octet-stream',
            metadata: file.metadata.metadata // preserve custom metadata
          }
        });
        
        // Ensure destination is public if clinical asset (common pattern in Kloqo)
        await destFile.makePublic();
        
        console.log(`   ✅ Copied: ${fileName}`);
        successCount++;
      } catch (err: any) {
        console.error(`   ❌ Failed: ${fileName} - ${err.message}`);
        failCount++;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. FINAL REPORT
    // ─────────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Migration Report [${DRY_RUN ? 'DRY RUN' : 'LIVE'}]`);
    console.log('='.repeat(60));
    console.log(`  Processed: ${files.length}`);
    console.log(`  Copied:    ${successCount}`);
    console.log(`  Skipped:   ${skipCount}`);
    console.log(`  Failed:    ${failCount}`);

    if (DRY_RUN) {
      console.log('\n🟡 Audit complete. No files were moved. Remove --dry-run for live migration.');
    } else {
      console.log('\n✅ Migration complete. Legacy storage remains untouched.');
    }

  } catch (err: any) {
    console.error(`\n[FATAL] Migration failed:`, err.message);
    if (err.message.includes('Bucket does not exist')) {
      console.warn(`💡 Hint: Check if the bucket name '${sourceBucket.name}' is correct.`);
    }
  } finally {
    process.exit(0);
  }
}

migrateStorage();
