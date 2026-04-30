import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';

/**
 * CLEANUP SCRIPT: Zombie Lock Remover
 * Run this to clear slots that are stuck because of the "Skipped Lock" bug.
 */
async function cleanupZombieLocks(doctorId: string, dateStr: string) {
  console.log(`\n🧹 Starting cleanup for Doctor: ${doctorId} on ${dateStr}...`);

  // 1. Fetch all locks for this doctor/date
  const locksSnapshot = await db.collection('slot-locks')
    .where('doctorId', '==', doctorId)
    .where('date', '==', dateStr)
    .get();

  if (locksSnapshot.empty) {
    console.log('✅ No locks found for this doctor/date.');
    return;
  }

  console.log(`🔍 Found ${locksSnapshot.size} total locks. Checking for zombies...`);

  // 2. Fetch all appointments to cross-reference
  const appointmentsSnapshot = await db.collection('appointments')
    .where('doctorId', '==', doctorId)
    .where('date', '==', dateStr)
    .get();

  const activeApptSlots = new Set();
  appointmentsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    // Only keep locks for people who are ACTUALLY in the queue
    if (['Pending', 'Confirmed', 'InConsultation'].includes(data.status)) {
      activeApptSlots.add(data.slotIndex);
    }
  });

  // 3. Identify and Delete Zombies
  let deletedCount = 0;
  const batch = db.batch();

  for (const doc of locksSnapshot.docs) {
    const lockData = doc.data();
    if (!activeApptSlots.has(lockData.slotIndex)) {
      console.log(`   🗑️ Deleting zombie lock for Slot ${lockData.slotIndex} (ID: ${doc.id})`);
      batch.delete(doc.ref);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    await batch.commit();
    console.log(`✅ Success! Removed ${deletedCount} zombie locks.`);
  } else {
    console.log('✅ No zombie locks found. All locks match active appointments.');
  }
}

// CONFIGURATION: Change these to match your current session
const TARGET_DOCTOR = 'doc-1776757867561';
const TARGET_DATE = '2026-04-30'; // Firestore ISO format used in locks

cleanupZombieLocks(TARGET_DOCTOR, TARGET_DATE)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  });
