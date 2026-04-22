const admin = require('firebase-admin');

// Initialize Firebase Admin (assuming default credentials or emulator)
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'kloqo-v2-dev' // update if needed, but it should pick up from GOOGLE_APPLICATION_CREDENTIALS or emulator
    });
}

// Or dynamically load it from the backend configs if needed
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const serviceAccountRegex = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (serviceAccountRegex && !admin.apps.length) {
     const serviceAccount = JSON.parse(serviceAccountRegex);
     admin.initializeApp({
         credential: admin.credential.cert(serviceAccount)
     });
}

const db = admin.firestore();

async function checkLatestAppointments() {
    console.log("Fetching the 3 most recently created appointments...");
    const snapshot = await db.collection('appointments')
        .orderBy('createdAt', 'desc')
        .limit(3)
        .get();

    if (snapshot.empty) {
        console.log("No appointments found.");
        return;
    }

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`\n--- Appointment ID: ${doc.id} ---`);
        console.log(`Patient Name: ${data.patientName}`);
        console.log(`Doctor: ${data.doctorName} (ID: ${data.doctorId})`);
        console.log(`Date: "${data.date}"`);
        console.log(`Time: "${data.time}"`);
        console.log(`Status: ${data.status}`);
        console.log(`Booked Via: ${data.bookedVia}`);
        console.log(`Session Index: ${data.sessionIndex}`);
        console.log(`Slot Index: ${data.slotIndex}`);
        console.log(`Created At: ${data.createdAt ? data.createdAt.toDate().toISOString() : 'N/A'}`);
    });
}

checkLatestAppointments().then(() => process.exit(0)).catch(console.error);
