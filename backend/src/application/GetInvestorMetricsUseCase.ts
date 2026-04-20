import { ISubscriptionRepository, IAppointmentRepository } from '../domain/repositories';

export interface InvestorMetrics {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  gmvRouted: number;
}

export class GetInvestorMetricsUseCase {
  constructor(
    private subscriptionRepo: ISubscriptionRepository,
    private appointmentRepo: IAppointmentRepository
  ) {}

  async execute(): Promise<InvestorMetrics> {
    try {
      const [mrr, activeCount, allAppts] = await Promise.all([
        this.subscriptionRepo.sumMRR(),
        this.subscriptionRepo.countByStatus('active'),
        // GMV is calculated from dispensed pharmacy transactions across the platform
        this.appointmentRepo.findCompletedByClinic('', { pharmacyStatus: 'dispensed' }).catch(() => [] as any[]),
      ]);

      const gmvRouted = (allAppts || []).reduce((sum: number, a: any) => sum + (a.dispensedValue || 0), 0);

      return {
        mrr,
        arr: mrr * 12,
        activeSubscriptions: activeCount,
        gmvRouted
      };
    } catch (error: any) {
      console.error(`[GetInvestorMetricsUseCase] Execution failed:`, error.message);
      throw new Error('Failed to calculate investor metrics.');
    }
  }
}
