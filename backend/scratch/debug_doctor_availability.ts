
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

async function checkDoctorProfile(doctorId: string) {
    console.log(`🔍 Checking Doctor Profile: ${doctorId}`);
    const doc = await db.collection('doctors').doc(doctorId).get();
    
    if (!doc.exists) {
        console.log('❌ Doctor profile not found.');
        return;
    }
    
    const d = doc.data() as any;
    console.log(`✅ Doctor Data:`);
    console.log(`- Name: ${d.name}`);
    console.log(`- ClinicId: ${d.clinicId}`);
    console.log(`- ConsultationStatus: ${d.consultationStatus}`);
    console.log(`- AvailabilitySlots: ${JSON.stringify(d.availabilitySlots || 'MISSING')}`);
    console.log(`- Session Start: ${d.sessionStartTime || 'MISSING'}`);
}

const targetDoctorId = 'doc-1776757867561';
checkDoctorProfile(targetDoctorId).catch(console.error);
