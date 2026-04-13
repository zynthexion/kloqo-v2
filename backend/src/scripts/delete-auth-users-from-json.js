const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// 1. Load Backend Env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountStr) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT not found in .env');
    process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountStr);
if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

// 2. Initialize
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

// FIX: Target backup folder from backend/src/scripts/ to kloqo-v2/backups/
const backupPath = path.resolve(__dirname, '../../../backups/2026-03-24T18-20-06-722Z/auth_users_backup.json');

async function run() {
    console.log(`⚠️ TARGET PROJECT: ${serviceAccount.project_id}`);

    // PART A: Delete from JSON backup
    if (fs.existsSync(backupPath)) {
        console.log(`📖 Reading backup from ${backupPath}...`);
        const users = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const uids = users.map(u => u.uid);
        
        console.log(`🚀 Found ${uids.length} uids in JSON. Starting batch deletion...`);
        
        // deleteUsers handles up to 1000 uids at a time
        for (let i = 0; i < uids.length; i += 1000) {
            const batch = uids.slice(i, i + 1000);
            try {
                const result = await auth.deleteUsers(batch);
                console.log(`✅ Deleted batch (${i} to ${Math.min(i + 1000, uids.length)}). Errors: ${result.errors.length}`);
            } catch (err) {
                console.error(`❌ Batch failed: ${err.message}`);
                console.log('Falling back to one-by-one deletion for this batch...');
                for (const uid of batch) {
                    try { await auth.deleteUser(uid); } catch (e) {}
                }
            }
        }
    } else {
        console.log(`❌ No backup JSON found at ${backupPath}`);
    }

    // PART B: Cleanup anything remaining (using listUsers)
    console.log('🔍 Checking for any remaining users via listUsers...');
    await cleanupRemaining();

    console.log('Done.');
}

async function cleanupRemaining(nextPageToken) {
    try {
        const result = await auth.listUsers(1000, nextPageToken);
        const uids = result.users.map(u => u.uid);
        
        if (uids.length > 0) {
            console.log(`🧹 Cleaning up ${uids.length} remaining users...`);
            await auth.deleteUsers(uids).catch(async () => {
                 for (const uid of uids) {
                    try { await auth.deleteUser(uid); } catch (e) {}
                }
            });
        }

        if (result.pageToken) {
            await cleanupRemaining(result.pageToken);
        }
    } catch (err) {
        console.log(`ℹ️ listUsers failed or finished: ${err.message}`);
    }
}

run().then(() => process.exit(0));
