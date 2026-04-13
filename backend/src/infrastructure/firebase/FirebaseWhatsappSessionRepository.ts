import { db } from './config';
import * as admin from 'firebase-admin';
import { IWhatsappSessionRepository, WhatsappSession } from '../../domain/repositories';

const COLLECTION = 'whatsapp_sessions';

/**
 * FirebaseWhatsappSessionRepository
 *
 * Persists 24-hour messaging window state per phone+clinic pair.
 * The compound document ID (phone_clinicId) enforces Rule 15 tenant isolation
 * at the database key level — a session cannot bleed across clinic boundaries.
 */
export class FirebaseWhatsappSessionRepository implements IWhatsappSessionRepository {
  private collection = db.collection('whatsapp_sessions');

  private makeDocId(phone: string, clinicId: string): string {
    // Normalise phone to digits only, then compound with clinicId
    const clean = phone.replace(/\D/g, '');
    return `${clean}_${clinicId}`;
  }

  async findByPhone(phone: string, clinicId: string): Promise<WhatsappSession | null> {
    const docId = this.makeDocId(phone, clinicId);
    const snap = await this.collection.doc(docId).get();

    if (!snap.exists) return null;

    const data = snap.data()!;
    return {
      phoneNumber: data.phoneNumber as string,
      clinicId: data.clinicId as string,
      lastMessageAt: data.lastMessageAt instanceof admin.firestore.Timestamp
        ? data.lastMessageAt.toDate()
        : new Date(data.lastMessageAt),
      isWindowOpen: data.isWindowOpen as boolean | undefined,
    };
  }

  async save(session: WhatsappSession): Promise<void> {
    const docId = this.makeDocId(session.phoneNumber, session.clinicId);
    await this.collection.doc(docId).set({
      phoneNumber: session.phoneNumber,
      clinicId: session.clinicId,
      lastMessageAt: admin.firestore.Timestamp.fromDate(
        session.lastMessageAt instanceof Date
          ? session.lastMessageAt
          : new Date(session.lastMessageAt)
      ),
      isWindowOpen: session.isWindowOpen ?? true,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }

  async update(phone: string, clinicId: string, data: Partial<WhatsappSession>): Promise<void> {
    const docId = this.makeDocId(phone, clinicId);
    const payload: Record<string, unknown> = { updatedAt: admin.firestore.Timestamp.now() };

    if (data.lastMessageAt !== undefined) {
      payload.lastMessageAt = admin.firestore.Timestamp.fromDate(
        data.lastMessageAt instanceof Date
          ? data.lastMessageAt
          : new Date(data.lastMessageAt)
      );
    }
    if (data.isWindowOpen !== undefined) {
      payload.isWindowOpen = data.isWindowOpen;
    }

    await this.collection.doc(docId).update(payload);
  }
}
