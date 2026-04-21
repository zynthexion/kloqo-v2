import * as admin from 'firebase-admin';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { db } from '../infrastructure/firebase/config';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BATCH_SIZE = 500;

async function migrate() {
    console.log('🔄 Starting removal of legacy grace period and delay fields...');

    const appointmentsRef = db.collection('appointments');
    let totalUpdated = 0;
    
    console.log(`[Appointments] Scanning all appointments...`);
    // Need to do this in batches because querying for existence of fields is tricky, 
    // and we might have many records.
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
    let hasMore = true;

    while (hasMore) {
        let query = appointmentsRef.limit(BATCH_SIZE);
        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            hasMore = false;
            break;
        }

        const batch = db.batch();
        let currentBatchCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            let needsUpdate = false;
            const updateData: any = {};

            if (data.doctorDelayMinutes !== undefined) {
                updateData.doctorDelayMinutes = admin.firestore.FieldValue.delete();
                needsUpdate = true;
            }
            if (data.noShowTime !== undefined) {
                updateData.noShowTime = admin.firestore.FieldValue.delete();
                needsUpdate = true;
            }
            if (data.cutOffTime !== undefined) {
                updateData.cutOffTime = admin.firestore.FieldValue.delete();
                needsUpdate = true;
            }

            if (needsUpdate) {
                batch.update(doc.ref, updateData);
                currentBatchCount++;
            }
        }

        if (currentBatchCount > 0) {
            await batch.commit();
            totalUpdated += currentBatchCount;
            console.log(`[Appointments] Processed batch. Deleted legacy fields from ${currentBatchCount} documents.`);
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    console.log(`\n✅ Migration complete! Removed legacy grace period fields from ${totalUpdated} appointments.`);
    process.exit(0);
}

migrate().catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
});
