import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

if (!admin.apps.length) {
  let credential;
  
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

  try {
    admin.initializeApp({
      credential,
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'kloqo-nurse-dup-43384903-8d386.firebasestorage.app'
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
    const snapshot = await query.get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));
    return { data, total: data.length, page: 1, limit: data.length, totalPages: 1 };
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
