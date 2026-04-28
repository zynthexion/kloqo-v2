import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

async function migrateAppointments() {
  const filePath = path.resolve(__dirname, '../../../backups/2026-03-24T18-20-06-722Z/appointments.json');
  console.log(`Reading legacy appointments from: ${filePath}`);

  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const appointmentsMap = JSON.parse(rawData);

    // V1 backup format check
    const appointments = Array.isArray(appointmentsMap) ? appointmentsMap : Object.values(appointmentsMap);
    console.log(`Found ${appointments.length} total legacy appointments.`);

    // Filter for January 2026
    const januaryAppointments = appointments.filter((a: any) => a.date && a.date.startsWith('2026-01'));
    console.log(`Found ${januaryAppointments.length} appointments in January 2026 to migrate.`);

    let migratedCount = 0;
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let currentBatchSize = 0;

    for (const appt of januaryAppointments as any[]) {
      const apptData: any = { ...appt };

      // 1. Delete redundant V1 fields (Data Pruning)
      delete apptData.age;
      delete apptData.sex;
      delete apptData.place;
      delete apptData.phone;
      delete apptData.communicationPhone;
      delete apptData.doctor; // Replaced by doctorId / doctorName
      delete apptData.department;
      delete apptData.cutOffTime;
      delete apptData.doctorDelayMinutes;
      delete apptData.reviewed;
      delete apptData.reviewId;

      // 2. Data Transformation
      if (apptData.noShowTime) {
        apptData.noShowAt = apptData.noShowTime;
        delete apptData.noShowTime;
      }

      // 3. Convert raw { _seconds, _nanoseconds } back to Firestore Timestamps
      for (const key of Object.keys(apptData)) {
        const val = apptData[key];
        if (val && typeof val === 'object' && '_seconds' in val && '_nanoseconds' in val) {
          apptData[key] = new admin.firestore.Timestamp(val._seconds, val._nanoseconds);
        }
      }

      // 4. Batch Write
      const apptRef = db.collection('appointments').doc(apptData.id);
      batch.set(apptRef, apptData, { merge: true });

      currentBatchSize++;
      migratedCount++;

      if (currentBatchSize >= BATCH_SIZE) {
        console.log(`Committing batch of ${currentBatchSize}... (${migratedCount}/${januaryAppointments.length})`);
        await batch.commit();
        batch = db.batch(); // Reset
        currentBatchSize = 0;
      }
    }

    if (currentBatchSize > 0) {
      console.log(`Committing final batch of ${currentBatchSize}... (${migratedCount}/${januaryAppointments.length})`);
      await batch.commit();
    }

    console.log(`\n🎉 --- Successfully migrated ${migratedCount} January appointments to V2! ---`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateAppointments();
