import { db } from './src/infrastructure/firebase/config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * USAGE: npx ts-node export-appointments.ts [date] [doctorId] [clinicId]
 * Default: 2026-04-23 doc-1776757867561 F9cIkgVcjXEfI7L63eoK
 */

async function exportAppointments() {
    const args = process.argv.slice(2);
    const date = args[0] || '2026-04-23';
    const doctorId = args[1] || 'doc-1776757867561';
    const clinicId = args[2] || 'F9cIkgVcjXEfI7L63eoK';

    console.log(`📡 Exporting appointments...`);
    console.log(`   - Date: ${date}`);
    console.log(`   - Doctor: ${doctorId}`);
    console.log(`   - Clinic: ${clinicId}`);

    try {
        const snapshot = await db.collection('appointments')
            .where('clinicId', '==', clinicId)
            .where('doctorId', '==', doctorId)
            .where('date', '==', date)
            .get();

        if (snapshot.empty) {
            console.log('⚠️ No appointments found for these criteria.');
            process.exit(0);
        }

        const appointments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort chronologically by time
        appointments.sort((a: any, b: any) => {
            const timeA = a.time || '';
            const timeB = b.time || '';
            return timeA.localeCompare(timeB);
        });

        const fileName = `appointments_${date}_${doctorId.slice(-5)}.json`;
        const filePath = path.join(process.cwd(), fileName);

        fs.writeFileSync(filePath, JSON.stringify(appointments, null, 2));

        console.log(`\n✅ Success!`);
        console.log(`📄 Saved ${appointments.length} records to: ${filePath}`);
        console.log(`💡 You can now use this file to compare snapshots before/after breaks.`);
    } catch (error) {
        console.error('\n❌ Export failed:', error);
    } finally {
        process.exit(0);
    }
}

exportAppointments();
