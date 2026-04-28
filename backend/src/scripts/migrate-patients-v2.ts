import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

async function migratePatients() {
  const filePath = path.resolve(__dirname, '../../../backups/2026-03-24T18-20-06-722Z/patients.json');
  console.log(`Reading legacy patients from: ${filePath}`);

  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const patientsMap = JSON.parse(rawData);

    // V1 was an indexed map: { "0": { patient1 }, "1": { patient2 } }
    const patients = Object.values(patientsMap);
    console.log(`Found ${patients.length} patients to migrate.`);

    let migratedCount = 0;
    const BATCH_SIZE = 400; // Safe under 500 limit
    let batch = db.batch();
    let currentBatchSize = 0;

    for (const p of patients) {
      const patientData: any = { ...p };

      // 1. Exclude deprecated/unnecessary fields
      delete patientData.visitHistory;
      delete patientData.totalAppointments;
      delete patientData.tutorialVideoSentAt;
      delete patientData.isPrimary;
      delete patientData.isKloqoMember;
      delete patientData.primaryUserId;

      // 2. Convert raw { _seconds, _nanoseconds } back to Firestore Timestamps
      for (const key of Object.keys(patientData)) {
        const val = patientData[key];
        if (val && typeof val === 'object' && '_seconds' in val && '_nanoseconds' in val) {
          patientData[key] = new admin.firestore.Timestamp(val._seconds, val._nanoseconds);
        }
      }

      // Add default updatedAt if missing to ensure sort consistency
      if (!patientData.updatedAt) {
          patientData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      }

      const patientRef = db.collection('patients').doc(patientData.id);
      batch.set(patientRef, patientData, { merge: true });

      currentBatchSize++;
      migratedCount++;

      // Commit if we hit the batch limit
      if (currentBatchSize >= BATCH_SIZE) {
        console.log(`Committing batch of ${currentBatchSize}... (${migratedCount}/${patients.length})`);
        await batch.commit();
        batch = db.batch(); // Reset batch
        currentBatchSize = 0;
      }
    }

    // Commit any remaining
    if (currentBatchSize > 0) {
      console.log(`Committing final batch of ${currentBatchSize}... (${migratedCount}/${patients.length})`);
      await batch.commit();
    }

    console.log(`\n🎉 --- Successfully migrated ${migratedCount} patients to V2! ---`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migratePatients();
