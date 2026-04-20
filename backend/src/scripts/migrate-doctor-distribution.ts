import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Initialize env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function migrate() {
  console.log('🚀 Starting Doctor Distribution Migration...');

  const clinicsSnapshot = await db.collection('clinics').get();
  let totalDoctorsPatched = 0;

  for (const clinicDoc of clinicsSnapshot.docs) {
    const clinicData = clinicDoc.data();
    const clinicDistribution = clinicData.tokenDistribution || 'advanced';
    const clinicReserveRatio = clinicData.walkInReserveRatio || 0.15;
    const clinicGracePeriod = clinicData.gracePeriodMinutes || 15;

    console.log(`\n🏥 Processing Clinic: ${clinicData.name} (${clinicDoc.id})`);
    console.log(`   - Default Distribution: ${clinicDistribution}`);

    const doctorsSnapshot = await db.collection('doctors')
      .where('clinicId', '==', clinicDoc.id)
      .get();

    if (doctorsSnapshot.empty) {
      console.log('   - No doctors found for this clinic.');
      continue;
    }

    const batch = db.batch();

    doctorsSnapshot.docs.forEach(doc => {
      const docRef = db.collection('doctors').doc(doc.id);
      const data = doc.data();

      // Only patch if missing or if we want to enforce the move
      batch.update(docRef, {
        tokenDistribution: data.tokenDistribution || clinicDistribution,
        walkInReserveRatio: data.walkInReserveRatio || clinicReserveRatio,
        gracePeriodMinutes: data.gracePeriodMinutes || clinicGracePeriod,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      totalDoctorsPatched++;
    });

    await batch.commit();
    console.log(`   ✅ Patched ${doctorsSnapshot.size} doctors.`);
  }

  console.log(`\n✨ Migration Complete. Total Doctors Patched: ${totalDoctorsPatched}`);
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
