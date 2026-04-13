const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

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

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

async function deleteAllUsers() {
    let usersDeleted = 0;
    try {
        const listUsersResult = await auth.listUsers(100);
        if (listUsersResult.users.length === 0) {
            console.log('✨ No users to delete.');
            return;
        }

        console.log(`🚀 Found ${listUsersResult.users.length} users in the first batch.`);
        
        // Use a loop to delete users one by one or in smaller chunks if the batch API is failing
        for (const user of listUsersResult.users) {
            await auth.deleteUser(user.uid);
            usersDeleted++;
        }
        
        console.log(`✅ Deleted ${usersDeleted} users. Running recursively for next batch...`);
        
        if (listUsersResult.pageToken) {
            await deleteAllUsers(); // Recursive
        } else {
            console.log('✅ ALL USERS DELETED.');
        }

    } catch (error) {
        console.error('🔥 Error during user deletion:', error);
    }
}

deleteAllUsers().then(() => process.exit(0));
