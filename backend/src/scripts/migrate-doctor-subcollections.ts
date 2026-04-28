import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';

async function migrateSubcollections() {
  console.log('Starting migration to sub-collections...');

  try {
    const doctorsSnapshot = await db.collection('doctors').get();
    let migratedCount = 0;

    for (const doc of doctorsSnapshot.docs) {
      const data = doc.data();
      const doctorId = doc.id;
      let hasUpdates = false;
      const batch = db.batch();

      // 1. Migrate Reviews
      if (data.reviewList && Array.isArray(data.reviewList) && data.reviewList.length > 0) {
        console.log(`Migrating ${data.reviewList.length} reviews for doctor ${doctorId}`);
        for (const review of data.reviewList) {
          const reviewId = review.id || db.collection('dummy').doc().id;
          const reviewRef = db.collection('doctors').doc(doctorId).collection('reviews').doc(reviewId);
          batch.set(reviewRef, review);
        }
        hasUpdates = true;
      }

      // 2. Migrate Breaks
      if (data.breakPeriods && typeof data.breakPeriods === 'object') {
        const breakDates = Object.keys(data.breakPeriods);
        if (breakDates.length > 0) {
          console.log(`Migrating breaks for ${breakDates.length} dates for doctor ${doctorId}`);
          for (const date of breakDates) {
            const breaksForDate = data.breakPeriods[date];
            // Use date string as document ID (e.g., '2026-04-23' or '23 April 2026')
            // Sanitize the date string for use as a document ID (no slashes)
            const safeDateId = date.replace(/\//g, '-');
            const breakRef = db.collection('doctors').doc(doctorId).collection('breaks').doc(safeDateId);
            batch.set(breakRef, { breaks: breaksForDate, date });
          }
          hasUpdates = true;
        }
      }

      // 3. Migrate Date Overrides
      if (data.dateOverrides && typeof data.dateOverrides === 'object') {
        const overrideDates = Object.keys(data.dateOverrides);
        if (overrideDates.length > 0) {
          console.log(`Migrating overrides for ${overrideDates.length} dates for doctor ${doctorId}`);
          for (const date of overrideDates) {
            const overrideData = data.dateOverrides[date];
            const safeDateId = date.replace(/\//g, '-');
            const overrideRef = db.collection('doctors').doc(doctorId).collection('overrides').doc(safeDateId);
            batch.set(overrideRef, { ...overrideData, date });
          }
          hasUpdates = true;
        }
      }

      // 4. Migrate Leaves
      if (data.leaves && Array.isArray(data.leaves) && data.leaves.length > 0) {
        console.log(`Migrating ${data.leaves.length} leaves for doctor ${doctorId}`);
        for (const leave of data.leaves) {
          if (leave.date) {
            const safeDateId = leave.date.replace(/\//g, '-');
            const leaveRef = db.collection('doctors').doc(doctorId).collection('leaves').doc(safeDateId);
            batch.set(leaveRef, leave);
          }
        }
        hasUpdates = true;
      }

      if (hasUpdates) {
        await batch.commit();
        migratedCount++;
        console.log(`✅ Completed sub-collection migration for doctor ${doctorId}`);
      }
    }

    console.log(`\n🎉 --- Migration complete! Migrated data for ${migratedCount} doctors. ---`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateSubcollections();
