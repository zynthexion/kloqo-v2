import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

// Initialize Firebase Admin (must use service account credentials or rely on GOOGLE_APPLICATION_CREDENTIALS)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket();

async function backfillRawInk() {
  console.log('--- Starting rawInkUrl Backfill ---');
  let updatedCount = 0;
  let missingCount = 0;
  let skippedCount = 0;

  try {
    const appointmentsRef = db.collection('appointments');
    // We only care about appointments that are completed and have a prescriptionUrl
    const snapshot = await appointmentsRef
      .where('status', '==', 'Completed')
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const apptId = doc.id;

      // Skip if already backfilled or if it doesn't have a prescription
      if (data.rawInkUrl || !data.prescriptionUrl) {
        skippedCount++;
        continue;
      }

      // We need clinicId, patientId, and completedAt to construct the storage path
      const clinicId = data.clinicId;
      const patientId = data.patientId;
      
      let completedAtDate: Date;
      if (data.completedAt?.toDate) {
        completedAtDate = data.completedAt.toDate();
      } else if (data.completedAt?._seconds) {
        completedAtDate = new Date(data.completedAt._seconds * 1000);
      } else if (data.completedAt) {
        completedAtDate = new Date(data.completedAt);
      } else {
        // Fallback to appointment date if completedAt is missing
        completedAtDate = new Date(data.date);
      }

      // Format date string to match storage path (yyyy-MM-dd)
      const year = completedAtDate.getFullYear();
      const month = String(completedAtDate.getMonth() + 1).padStart(2, '0');
      const day = String(completedAtDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const rawPath = `raw-ink/${clinicId}/${dateStr}/${patientId}_${apptId}.png`;
      const file = bucket.file(rawPath);

      const [exists] = await file.exists();

      if (exists) {
        // Construct the URL exactly as the backend does
        const rawInkUrl = `https://storage.googleapis.com/${bucket.name}/${rawPath}`;
        
        // Update document. Note: isInkIsolated is NOT set to true, 
        // as old PNGs are flattened with the template.
        await doc.ref.update({
          rawInkUrl: rawInkUrl
        });

        updatedCount++;
        console.log(`[UPDATED] ${apptId}: ${rawPath}`);
      } else {
        missingCount++;
        console.log(`[MISSING] ${apptId}: Could not find file at ${rawPath}`);
      }
    }

    console.log('--- Backfill Complete ---');
    console.log(`Total Completed Appointments: ${snapshot.docs.length}`);
    console.log(`Updated (Found PNG): ${updatedCount}`);
    console.log(`Missing (No PNG found): ${missingCount}`);
    console.log(`Skipped (Already backfilled or no Rx): ${skippedCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

backfillRawInk();
