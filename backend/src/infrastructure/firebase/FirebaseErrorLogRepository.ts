import { IErrorLogRepository } from '../../domain/repositories';
import { ErrorLog, PaginationParams, PaginatedResponse } from '../../../../packages/shared/src/index';
import { db, paginate } from './config';

export class FirebaseErrorLogRepository implements IErrorLogRepository {
  private collectionPath = 'error_logs';

  async findAll(params?: PaginationParams): Promise<ErrorLog[] | PaginatedResponse<ErrorLog>> {
    const query = db.collection(this.collectionPath)
      .orderBy('timestamp', 'desc');
      
    return paginate<ErrorLog>(query, params);
  }

  async save(errorLog: ErrorLog): Promise<void> {
    const { id, ...data } = errorLog;
    await db.collection(this.collectionPath).doc(id).set({
      ...data,
      timestamp: data.timestamp || new Date(), // Fallback if timestamp not provided
      updatedAt: new Date()
    });
  }
}
