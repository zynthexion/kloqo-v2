import { db } from '../infrastructure/firebase/config';

async function deleteNonJanuaryPatients() {
  const snapshot = await db.collection('patients').get();
  
  const patientsToDelete: string[] = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.createdAt) {
      let date: Date;
      if (typeof data.createdAt.toDate === 'function') {
        date = data.createdAt.toDate();
      } else {
        date = new Date(data.createdAt);
      }
      // If it's not January (month 0 in JS Date)
      if (date.getMonth() !== 0) {
        patientsToDelete.push(doc.id);
      }
    }
  });

  console.log(`Found ${patientsToDelete.length} patients not from January. Starting deletion...`);

  if (patientsToDelete.length === 0) {
    console.log('No patients to delete.');
    process.exit(0);
  }

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let count = 0;
  let totalDeleted = 0;

  for (const id of patientsToDelete) {
    const ref = db.collection('patients').doc(id);
    batch.delete(ref);
    count++;
    totalDeleted++;

    if (count >= BATCH_SIZE) {
      console.log(`Committing batch of ${count} deletions...`);
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    console.log(`Committing final batch of ${count} deletions...`);
    await batch.commit();
  }

  console.log(`\n🎉 --- Successfully deleted ${totalDeleted} non-January patients! ---`);
  process.exit(0);
}

deleteNonJanuaryPatients();
