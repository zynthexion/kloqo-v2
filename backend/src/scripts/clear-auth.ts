import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * CLEAR-AUTH SCRIPT
 * 
 * Purpose: Completely purge the destination Authentication user list before migration.
 * Target: The project defined in .env (NEW/DUP project).
 * 
 * WARNING: THIS IS DESTRUCTIVE. USE ONLY ON THE DUPLICATE/TEST ENIVRONMENT.
 */

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function clearAuthUsers() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  console.log('==============================================');
  console.log('⚠️  AUTH USER PURGE SCRIPT ⚠️');
  console.log(`TARGET PROJECT: ${projectId}`);
  console.log('==============================================');

  let totalDeleted = 0;
  let nextPageToken: string | undefined = undefined;

  try {
    do {
      const result = await admin.auth().listUsers(100, nextPageToken);
      const uids = result.users.map(u => u.uid);
      
      if (uids.length > 0) {
        const deleteResult = await admin.auth().deleteUsers(uids);
        totalDeleted += deleteResult.successCount;
        console.log(`  Deleted ${deleteResult.successCount} users... (Total: ${totalDeleted})`);
        
        if (deleteResult.failureCount > 0) {
            console.error(`  Failed to delete ${deleteResult.failureCount} users.`);
        }
      }
      
      nextPageToken = result.pageToken;
    } while (nextPageToken);

    console.log('\n==============================================');
    console.log(`✅ AUTH PURGE COMPLETED: ${totalDeleted} users removed.`);
    console.log('==============================================');

  } catch (error) {
    console.error('Auth Purge Failed:', error);
    process.exit(1);
  }
}

clearAuthUsers();
