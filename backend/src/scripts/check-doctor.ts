
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDoctor() {
  const doctorId = "xjxVEmRCkWUTuQyYmPmQ"; // From the SSE logs
  const doc = await db.collection('doctors').doc(doctorId).get();
  if (!doc.exists) {
    console.log('Doctor not found');
    return;
  }
  const data = doc.data();
  console.log('Doctor Name:', data.name);
  console.log('Clinic ID:', data.clinicId);
  console.log('Advance Booking Days:', data.advanceBookingDays);
  console.log('Availability Slots:', JSON.stringify(data.availabilitySlots, null, 2));
  console.log('Date Overrides:', JSON.stringify(data.dateOverrides, null, 2));
}

checkDoctor();
