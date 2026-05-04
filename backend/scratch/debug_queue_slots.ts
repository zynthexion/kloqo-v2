
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkQueueData(clinicId: string, doctorId: string, date: string) {
    console.log(`🔍 Checking appointments for Clinic: ${clinicId}, Doctor: ${doctorId}, Date: ${date}`);
    
    const snapshot = await db.collection('appointments')
        .where('clinicId', '==', clinicId)
        .where('doctorId', '==', doctorId)
        .where('date', '==', date)
        .get();
        
    console.log(`✅ Found ${snapshot.size} appointments.`);
    
    snapshot.forEach(doc => {
        const d = doc.data();
        console.log(`- Appointment ${d.id}: Token ${d.tokenNumber}, Status: ${d.status}, SlotIndex: ${d.slotIndex}`);
    });
}

// These IDs are from the previous conversation log
const clinicId = 'F9cIkgVcjXEfI7L63eoK';
const doctorId = 'doc-1776757867561';
const date = '2026-05-04';

checkQueueData(clinicId, doctorId, date).catch(console.error);
