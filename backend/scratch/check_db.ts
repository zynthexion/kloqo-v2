
import * as admin from 'firebase-admin';
import path from 'path';

// Initialize Firebase Admin (assuming local emulator)
if (!admin.apps.length) {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    admin.initializeApp({
        projectId: 'kloqo-v2-dev'
    });
}

const db = admin.firestore();

async function checkAppointments(patientId: string, phone: string) {
    console.log(`🔍 Checking appointments for patientId: ${patientId} OR phone: ${phone}`);
    
    const snapshotByPatient = await db.collection('appointments')
        .where('patientId', '==', patientId)
        .get();
        
    const snapshotByPhone = await db.collection('appointments')
        .where('patientPhone', '==', phone)
        .get();
        
    const allDocs = new Map();
    snapshotByPatient.docs.forEach(doc => allDocs.set(doc.id, doc.data()));
    snapshotByPhone.docs.forEach(doc => allDocs.set(doc.id, doc.data()));
        
    if (allDocs.size === 0) {
        console.log('❌ No appointments found for this patient or phone.');
        return;
    }
    
    console.log(`✅ Found ${allDocs.size} appointments:`);
    allDocs.forEach((d, id) => {
        console.log(`- ID: ${id}`);
        console.log(`  PatientId: ${d.patientId}`);
        console.log(`  PatientPhone: ${d.patientPhone}`);
        console.log(`  Status: ${d.status}`);
        console.log(`  Date: ${d.date}`);
        console.log(`  IsDeleted: ${d.isDeleted}`);
    });
}

const patientId = process.argv[2] || 'p-1776787174430-8gnr6z1';
const phone = process.argv[3] || '+919074297625';
checkAppointments(patientId, phone).catch(console.error);
