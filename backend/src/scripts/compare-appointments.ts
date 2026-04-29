import * as fs from 'fs';

const oldPath = '/Users/jinodevasia/Desktop/Kloqo-Production copy/kloqo-v2/backups/2026-03-24T18-20-06-722Z/appointments.json';
const newPath = '/Users/jinodevasia/Desktop/Kloqo-Production copy/kloqo-v2/backups/v2-backups/2026-04-28T03-13-45-080Z/appointments.json';

const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
const newData = JSON.parse(fs.readFileSync(newPath, 'utf-8'));

// The old backup might be an array or an indexed object { "0": {...} }
const oldAppointments = Array.isArray(oldData) ? oldData : Object.values(oldData);
// The new backup is an object { "docId": {...} }
const newAppointments = Array.isArray(newData) ? newData : Object.values(newData);

const oldKeys = new Set<string>();
for (const appt of oldAppointments as any[]) {
    Object.keys(appt).forEach(k => oldKeys.add(k));
}

const newKeys = new Set<string>();
for (const appt of newAppointments as any[]) {
    Object.keys(appt).forEach(k => newKeys.add(k));
}

const missingInNew = [...oldKeys].filter(k => !newKeys.has(k));
const newlyAdded = [...newKeys].filter(k => !oldKeys.has(k));

console.log("Fields present in Legacy but MISSING in V2:");
missingInNew.forEach(k => console.log(`- ${k}`));

console.log("\nFields newly ADDED in V2 (not in legacy):");
newlyAdded.forEach(k => console.log(`- ${k}`));
