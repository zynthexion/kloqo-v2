import * as fs from 'fs';
import * as path from 'path';

const v1Dir = '/Users/jinodevasia/Desktop/Kloqo-Production copy/kloqo-v2/backups/2026-03-24T18-20-06-722Z';
const v2Dir = '/Users/jinodevasia/Desktop/Kloqo-Production copy/kloqo-v2/backups/v2-backups/2026-04-28T03-13-45-080Z';

const collections = ['appointments', 'clinics', 'doctors', 'patients'];

for (const coll of collections) {
    const oldPath = path.join(v1Dir, `${coll}.json`);
    const newPath = path.join(v2Dir, `${coll}.json`);

    if (!fs.existsSync(oldPath) || !fs.existsSync(newPath)) {
        console.log(`Skipping ${coll} (files not found)`);
        continue;
    }

    const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf-8'));
    const newData = JSON.parse(fs.readFileSync(newPath, 'utf-8'));

    const oldDocs = Array.isArray(oldData) ? oldData : Object.values(oldData);
    const newDocs = Array.isArray(newData) ? newData : Object.values(newData);

    const oldKeys = new Set<string>();
    for (const doc of oldDocs as any[]) {
        Object.keys(doc).forEach(k => oldKeys.add(k));
    }

    const newKeys = new Set<string>();
    for (const doc of newDocs as any[]) {
        Object.keys(doc).forEach(k => newKeys.add(k));
    }

    const missingInNew = [...oldKeys].filter(k => !newKeys.has(k)).sort();
    const newlyAdded = [...newKeys].filter(k => !oldKeys.has(k)).sort();

    console.log(`\n===========================================`);
    console.log(` COLLECTION: ${coll.toUpperCase()}`);
    console.log(`===========================================`);
    console.log(`\n🔴 In V1 but NOT in V2 (Deprecated/Decoupled):`);
    missingInNew.forEach(k => console.log(`  - ${k}`));
    if (missingInNew.length === 0) console.log("  (None)");

    console.log(`\n🟢 In V2 but NOT in V1 (New Additions):`);
    newlyAdded.forEach(k => console.log(`  - ${k}`));
    if (newlyAdded.length === 0) console.log("  (None)");
}
