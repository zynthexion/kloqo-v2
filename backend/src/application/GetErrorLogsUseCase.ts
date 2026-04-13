import { IErrorLogRepository } from '../domain/repositories';
import { ErrorLog, PaginationParams, PaginatedResponse } from '../../../packages/shared/src/index';

export class GetErrorLogsUseCase {
  constructor(private errorLogRepo: IErrorLogRepository) {}

  async execute(params?: PaginationParams): Promise<ErrorLog[] | PaginatedResponse<ErrorLog>> {
    return this.errorLogRepo.findAll(params);
  }
}
