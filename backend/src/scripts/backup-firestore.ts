import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

async function backup() {
    console.log('--- Starting Firestore Backup (OLD Project) ---');
    
    const oldSaPath = path.resolve(__dirname, '../../old_service_account.json');
    if (!fs.existsSync(oldSaPath)) {
        console.error('Error: old_service_account.json not found.');
        process.exit(1);
    }

    const oldSa = JSON.parse(fs.readFileSync(oldSaPath, 'utf8'));

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(oldSa)
        });
    }

    const db = admin.firestore();
    
    const collections = [
        'app_traffic',
        'appointments',
        'campaign_sends',
        'campaign_summaries',
        'clinics',
        'consultation-counters',
        'doctor_punctuality_logs',
        'doctors',
        'error_logs',
        'magic_links',
        'marketing_analytics',
        'marketing_interactions',
        'master-departments',
        'patients',
        'reviews',
        'slot-reservations',
        'system-config',
        'token-counters',
        'users',
        'whatsapp_sessions'
    ];

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../../../backups', timestamp);

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    for (const col of collections) {
        console.log(`Backing up collection: ${col}...`);
        const snapshot = await db.collection(col).get();
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const filePath = path.join(backupDir, `${col}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`  Done: ${data.length} documents saved to ${col}.json`);
    }

    console.log(`--- Backup complete! Saved to ${backupDir} ---`);
    process.exit(0);
}

backup().catch(err => {
    console.error('Backup failed:', err);
    process.exit(1);
});
