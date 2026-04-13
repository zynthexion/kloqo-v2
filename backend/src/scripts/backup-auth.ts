import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

/**
 * BACKUP SCRIPT: Firebase Authentication Users
 * 
 * This script exports all users from the source Firebase project to a local JSON file.
 */

const oldSaPath = path.resolve(__dirname, '../../old_service_account.json');

if (!fs.existsSync(oldSaPath)) {
  console.error('Error: old_service_account.json not found.');
  process.exit(1);
}

const oldSa = JSON.parse(fs.readFileSync(oldSaPath, 'utf8'));

// Initialize Source App
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(oldSa)
  });
}

async function backupUsers() {
  console.log('Starting Authentication User Backup...');
  console.log(`Source Project: ${oldSa.project_id}`);

  const backupDir = path.resolve(__dirname, '../../../backups', new Date().toISOString().replace(/[:.]/g, '-'));
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, 'auth_users_backup.json');
  let allUsers: any[] = [];
  let nextPageToken: string | undefined = undefined;

  try {
    do {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      allUsers = allUsers.concat(result.users);
      nextPageToken = result.pageToken;
      console.log(`Fetched ${allUsers.length} users...`);
    } while (nextPageToken);

    fs.writeFileSync(backupFile, JSON.stringify(allUsers, null, 2));
    
    console.log('\n=========================================');
    console.log(`BACKUP COMPLETED: ${allUsers.length} users saved to:`);
    console.log(backupFile);
    console.log('=========================================');

  } catch (error) {
    console.error('Backup Failed:', error);
  }
}

backupUsers();
