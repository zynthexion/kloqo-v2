import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * IS_LOCAL_STANDALONE — controls which database backend Kloqo targets.
 *
 * true  → Standalone/On-Premise mode: all data stored on the clinic's local PC
 *          via the Firebase Local Emulator Suite (no data leaves the building).
 * false → Cloud SaaS mode: standard Google Cloud Firestore (default).
 *
 * Set IS_LOCAL_STANDALONE=true in the local clinic's .env file.
 */
export const IS_LOCAL_STANDALONE = process.env.IS_LOCAL_STANDALONE === 'true';

if (!admin.apps.length) {
  let credential;

  if (IS_LOCAL_STANDALONE) {
    // ── Local Standalone Mode ───────────────────────────────────────────────
    // In this mode, Firebase Admin connects to the local Firestore Emulator.
    // The FIRESTORE_EMULATOR_HOST env var tells the SDK where the emulator is.
    // If not explicitly set, default to localhost:8080 (Firebase Emulator default).
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    }
    // Use a dummy credential for the emulator — it does not need real Firebase credentials.
    credential = admin.credential.applicationDefault();
    console.log('🏥 [LOCAL STANDALONE] Kloqo is running in On-Premise mode.');
    console.log(`📦 [LOCAL STANDALONE] Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  } else {
    // ── Cloud SaaS Mode ────────────────────────────────────────────────────
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      // Fix for common newline issue in environment variables
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      credential = admin.credential.cert(serviceAccount);
    } else {
      // Fallback to individual environment variables (common in Vercel/Render)
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      });
    }
  }

  try {
    admin.initializeApp({
      credential,
      // databaseURL and storageBucket are only relevant in Cloud mode.
      // In local standalone mode, these point to the emulator automatically.
      ...(!IS_LOCAL_STANDALONE && {
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'kloqo-nurse-dup-43384903-8d386.firebasestorage.app'
      }),
    });
    console.log('🔥 Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
  }
}

export const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
export const storage = admin.storage();

export const paginate = async <T>(
  query: admin.firestore.Query,
  params?: { page: number; limit: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }
): Promise<{ data: T[]; total: number; page: number; limit: number; totalPages: number }> => {
  if (!params) {
    // ✅ FINOPS: Enforce hard limit on unbounded queries
    const snapshot = await query.limit(100).get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));
    return { data, total: data.length, page: 1, limit: 100, totalPages: 1 };
  }

  const { page, limit, sortBy, sortOrder = 'desc' } = params;
  let paginatedQuery = query;

  if (sortBy) {
    paginatedQuery = paginatedQuery.orderBy(sortBy, sortOrder);
  }

  const offset = (page - 1) * limit;
  
  // Get total count using native aggregation if possible (requires firebase-admin v11.3.0+)
  // Otherwise fallback to size (inefficient but works for now)
  const totalSnapshot = await query.count().get();
  const total = totalSnapshot.data().count;

  const snapshot = await paginatedQuery.limit(limit).offset(offset).get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
};
