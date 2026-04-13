import { IErrorLogRepository } from '../domain/repositories';
import { ErrorLog } from '@kloqo/shared';
import { v4 as uuidv4 } from 'uuid';

export class LogErrorUseCase {
  constructor(private errorLogRepo: IErrorLogRepository) {}

  async execute(data: Omit<ErrorLog, 'id' | 'timestamp'>): Promise<void> {
    const errorLog: ErrorLog = {
      ...data,
      id: uuidv4(),
      timestamp: new Date()
    };

    await this.errorLogRepo.save(errorLog);
  }
}
