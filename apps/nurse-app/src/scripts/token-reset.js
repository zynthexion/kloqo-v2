const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // User must provide this

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function resetTokens() {
  console.log('🚀 Starting Pre-Flight Token & Lock Reset...');
  console.log('⚠️  This script does NOT delete appointments or patients. Use Firebase CLI for that.');

  // 1. Reset Token Counters (currentNumber reset to 0)
  const countersSnapshot = await db.collection('token-counters').get();
  console.log(`📍 Found ${countersSnapshot.size} token counters. Resetting currentNumber...`);
  const counterBatch = db.batch();
  countersSnapshot.docs.forEach(doc => {
    counterBatch.update(doc.ref, { 
      count: 0, 
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await counterBatch.commit();
  console.log('✅ Token counters reset to 0.');

  // 2. Clear Session Booked Counts (Ephemeral session tracking)
  const sessionCountsSnapshot = await db.collection('session-booked-counts').get();
  console.log(`📍 Found ${sessionCountsSnapshot.size} session counters. Clearing...`);
  const sessionBatch = db.batch();
  sessionCountsSnapshot.docs.forEach(doc => {
    sessionBatch.delete(doc.ref);
  });
  await sessionBatch.commit();
  console.log('✅ Session booked counts cleared.');

  // 3. Clear Slot Locks (Ephemeral concurrency locks)
  const locksSnapshot = await db.collection('slot-locks').get();
  console.log(`📍 Found ${locksSnapshot.size} orphaned slot locks. Clearing...`);
  const lockBatch = db.batch();
  locksSnapshot.docs.forEach(doc => {
    lockBatch.delete(doc.ref);
  });
  await lockBatch.commit();
  console.log('✅ Slot locks cleared.');

  console.log('🏁 Pre-flight reset complete. Ephemeral state is clean.');
}

resetTokens().catch(console.error);
