import { db } from '../infrastructure/firebase/config';
import * as fs from 'fs';
import * as path from 'path';

async function runBackup() {
  console.log('--- Starting Kloqo V2 Firestore Backup ---');
  
  try {
    // db.listCollections() returns all root collections
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} root collections to backup.`);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '../../../backups/v2-backups', timestamp);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    for (const colRef of collections) {
      const colName = colRef.id;
      console.log(`Backing up collection: ${colName}...`);
      
      const snapshot = await colRef.get();
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const filePath = path.join(backupDir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`  Done: ${data.length} documents saved to ${colName}.json`);
    }

    console.log(`\n🎉 --- Backup complete! Saved to ${backupDir} ---`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

runBackup();
