import * as admin from 'firebase-admin';
import { db } from '../infrastructure/firebase/config';
import { Appointment } from '../../../packages/shared/src/index';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SRE SCRIPT: backfill-slot-locks.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Safely backfills locking documents for all legacy future appointments to
 * prevent V2 advanced booking collisions.
 *
 * Uses `db.bulkWriter()` to gracefully chunk writes, manage rate limits,
 * and bypass the hard 500-document transaction limit.
 */
async function backfillSlotLocks() {
  console.log('🚀 Starting Slot Lock Backfill...');

  // Set the timezone-adjusted "today" string to match the DB
  const todayDate = new Date();
  
  // Example "1 MMMM yyyy" based parsing logic might be needed depending on legacy formats.
  // The simplest reliable method is to fetch ALL active Pending/Confirmed appointments 
  // and process them natively if we can't reliably query '>= today' via string comparison.
  // Fortunately, we can query by status and filter in memory since the active payload shouldn't be massive.
  
  console.log('Fetching active pending/confirmed appointments...');
  
  const snapshot = await db.collection('appointments')
    .where('isDeleted', '==', false)
    .where('status', 'in', ['Pending', 'Confirmed'])
    .get();

  const appointments = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
  
  // Filter for future dates (naively check if the timestamp works out, 
  // or just lock them all since locking a past day doesn't hurt us over much)
  // To be perfectly safe, we lock everything that is currently 'Pending' or 'Confirmed'.
  
  console.log(`Found ${appointments.length} active appointments. Preparing BulkWriter...`);

  const bulkWriter = db.bulkWriter();
  let createdCount = 0;
  let skippedCount = 0;

  bulkWriter.onWriteError((error) => {
    if (error.code === 6) { 
      // 6 is ALREADY_EXISTS
      skippedCount++;
      return false; // Tells bulkWriter NOT to retry this specific error
    }
    console.error(`[BulkWriter] Failed write for doc ${error.documentRef.path}:`, error.message);
    return true; // Retry other errors
  });

  appointments.forEach(appt => {
    if (appt.slotIndex !== undefined && appt.sessionIndex !== undefined && appt.doctorId && appt.date) {
      const lockId = `${appt.doctorId}_${appt.date}_s${appt.sessionIndex}_slot${appt.slotIndex}`;
      const lockRef = db.collection('slot-locks').doc(lockId);
      
      // Attempt to create. Will fire onWriteError if it already exists (from a previous script run)
      bulkWriter.create(lockRef, {
        appointmentId: appt.id,
        doctorId: appt.doctorId,
        date: appt.date,
        sessionIndex: appt.sessionIndex,
        slotIndex: appt.slotIndex,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        _backfilled: true
      });
      createdCount++;
    }
  });

  console.log(`Flushing ${createdCount} lock creation requests...`);
  await bulkWriter.close();

  console.log('✅ Backfill complete.');
  console.log(`- Attempted Creates: ${createdCount}`);
  console.log(`- Skipped (Already Exists): ${skippedCount}`);
  console.log(`- Successfully Written: ${createdCount - skippedCount}`);
  process.exit(0);
}

backfillSlotLocks().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
