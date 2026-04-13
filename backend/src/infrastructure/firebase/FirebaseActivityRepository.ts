import { IActivityRepository } from '../../domain/repositories';
import { ActivityLog } from '../../../../packages/shared/src/index';
import { db } from './config';

export class FirebaseActivityRepository implements IActivityRepository {
    private collection = db.collection('activities');

    async save(activity: ActivityLog): Promise<void> {
        // Ensure TTL is set (90 days from now)
        const ninetyDaysInSeconds = 90 * 24 * 60 * 60;
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + ninetyDaysInSeconds);

        const activityRecord = {
            ...activity,
            expiresAt: expiresAt,
            timestamp: activity.timestamp || new Date()
        };

        if (activityRecord.id) {
            await this.collection.doc(activityRecord.id).set(activityRecord);
        } else {
            await this.collection.add(activityRecord);
        }
    }

    async findByDoctor(doctorId: string, clinicId: string, limit: number = 50): Promise<ActivityLog[]> {
        const snapshot = await this.collection
            .where('doctorId', '==', doctorId)
            .where('clinicId', '==', clinicId)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
    }
}
