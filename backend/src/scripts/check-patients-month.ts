import { db } from '../infrastructure/firebase/config';

async function checkPatientsMonth() {
  const snapshot = await db.collection('patients').get();
  const counts: Record<string, number> = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.createdAt) {
      let date: Date;
      if (typeof data.createdAt.toDate === 'function') {
        date = data.createdAt.toDate();
      } else {
        date = new Date(data.createdAt);
      }
      const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
      counts[monthYear] = (counts[monthYear] || 0) + 1;
    } else {
      counts['no_date'] = (counts['no_date'] || 0) + 1;
    }
  });

  console.log('Patient counts by creation month:');
  console.log(counts);
  process.exit(0);
}

checkPatientsMonth();
