import { db } from '../infrastructure/firebase/config';
import * as admin from 'firebase-admin';

async function addUser() {
  const userId = "XUy3aWRHPiP7dFtpBKXezDhEEo32";
  
  const userData = {
    id: userId,
    uid: userId,
    clinicId: "FxJvKbeZutWOhXxQgySH",
    createdAt: admin.firestore.Timestamp.fromDate(new Date("2026-01-05T00:00:00Z")),
    email: "kochusmani49@gmail.com",
    isDeleted: false,
    name: "Kochu S Mani",
    phone: "+919847951676",
    role: "clinicAdmin",
    roles: ["clinicAdmin", "doctor"],
    updatedAt: admin.firestore.Timestamp.fromDate(new Date("2026-04-22T05:28:41Z"))
  };

  try {
    await db.collection('users').doc(userId).set(userData);
    console.log(`✅ Successfully added user "${userData.name}" (${userId}) to V2 database.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to add user:', error);
    process.exit(1);
  }
}

addUser();
