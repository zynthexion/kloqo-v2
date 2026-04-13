import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * MIGRATION SCRIPT: Firebase Authentication Users
 * 
 * This script copies users from a source Firebase project to a destination project.
 */

const backupPath = process.argv[2];
const newSaEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!backupPath) {
  console.error('Error: Please provide the path to the auth backup JSON file.');
  console.error('Example: ts-node src/scripts/migrate-auth-users.ts ../backups/TIMESTAMP/auth_users_backup.json');
  process.exit(1);
}

const absoluteBackupPath = path.resolve(process.cwd(), backupPath);

if (!fs.existsSync(absoluteBackupPath)) {
  console.error(`Error: Backup file not found at ${absoluteBackupPath}`);
  process.exit(1);
}

const newSa = JSON.parse(newSaEnv || '{}');

if (newSa.private_key) {
  newSa.private_key = newSa.private_key.replace(/\\n/g, '\n');
}

// Initialize Destination App (default)
const destApp = admin.initializeApp({
  credential: admin.credential.cert(newSa)
}, 'destination');

async function migrateUsers() {
  console.log('Starting Authentication User Migration from Backup...');
  console.log(`Source File: ${absoluteBackupPath}`);
  console.log(`Destination Project: ${newSa.project_id}`);

  try {
    const rawData = fs.readFileSync(absoluteBackupPath, 'utf8');
    const users = JSON.parse(rawData);

    if (!Array.isArray(users)) {
      throw new Error('Backup content is not an array.');
    }

    console.log(`Found ${users.length} users in backup.`);

    const batchSize = 1000;
    let totalMigrated = 0;

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      // Map users for import
      const usersToImport = batch.map((u: any) => {
        const importData: any = {
          uid: u.uid,
          email: u.email,
          emailVerified: u.emailVerified,
          displayName: u.displayName,
          photoURL: u.photoURL,
          phoneNumber: u.phoneNumber,
          disabled: u.disabled,
          metadata: u.metadata,
          customClaims: u.customClaims,
          providerData: u.providerData,
        };
        return importData;
      });

      // Import to destination
      const importResult = await destApp.auth().importUsers(usersToImport);

      console.log(`Imported batch ${i / batchSize + 1}. Errors: ${importResult.failureCount}`);
      if (importResult.failureCount > 0) {
        importResult.errors.forEach(err => {
          console.error(`- Error for UID ${usersToImport[err.index].uid}: ${err.error.message}`);
        });
      }

      totalMigrated += batch.length - importResult.failureCount;
    }

    console.log('\n=========================================');
    console.log(`MIGRATION COMPLETED: ${totalMigrated} users migrated.`);
    console.log('=========================================');
    console.log('OTP (Phone) users will be able to log in seamlessly.');

  } catch (error) {
    console.error('Migration Failed:', error);
  }
}

migrateUsers();
