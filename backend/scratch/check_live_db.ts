
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

async function checkSpecificPatient(patientId: string) {
    console.log(`🔍 Checking patient profile: ${patientId}`);
    const doc = await db.collection('patients').doc(patientId).get();
    
    if (!doc.exists) {
        console.log('❌ Patient profile not found.');
        return;
    }
    
    const d = doc.data() as any;
    console.log(`✅ Patient Data:`);
    console.log(`- Name: ${d.name}`);
    console.log(`- Phone: ${d.phone}`);
    console.log(`- Related IDs: ${d.relatedPatientIds?.join(', ') || 'None'}`);
}

const targetPatientId = 'p-1777388284374-48fobuk';
checkSpecificPatient(targetPatientId).catch(console.error);
