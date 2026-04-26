import { Request, Response } from 'express';
import { GetSuperadminDashboardUseCase } from '../application/GetSuperadminDashboardUseCase';
import { GetPunctualityLogsUseCase } from '../application/GetPunctualityLogsUseCase';
import { GetErrorLogsUseCase } from '../application/GetErrorLogsUseCase';
import { GetClinicDashboardUseCase } from '../application/GetClinicDashboardUseCase';
import { GetProviderPerformanceUseCase } from '../application/GetProviderPerformanceUseCase';
import { LogErrorUseCase } from '../application/LogErrorUseCase';
import { GetInvestorMetricsUseCase } from '../application/GetInvestorMetricsUseCase';
import { ClinicNotApprovedError, OnboardingIncompleteError } from '../domain/errors';
import { RBACUtils, KLOQO_ROLES } from '@kloqo/shared';

export class AnalyticsController {
  constructor(
    private getSuperadminDashboardUseCase: GetSuperadminDashboardUseCase,
    private getPunctualityLogsUseCase: GetPunctualityLogsUseCase,
    private getErrorLogsUseCase: GetErrorLogsUseCase,
    private getClinicDashboardUseCase: GetClinicDashboardUseCase,
    private getProviderPerformanceUseCase: GetProviderPerformanceUseCase,
    private logErrorUseCase: LogErrorUseCase,
    private getInvestorMetricsUseCase: GetInvestorMetricsUseCase
  ) {}

  async getProviderPerformance(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const clinicId = user?.clinicId;
      if (!clinicId) return res.status(403).json({ error: 'Clinic ID not found in session' });

      const { start, end } = req.query;
      const data = await this.getProviderPerformanceUseCase.execute(clinicId, {
        startDate: start as string,
        endDate: end as string
      });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getClinicDashboard(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const clinicId = user?.clinicId;
      if (!clinicId) return res.status(403).json({ error: 'Clinic ID not found in session' });

      const { start, end } = req.query;
      let { doctorId } = req.query as any;

      // 🛡️ SECURITY: Enforce Doctor-Only View for non-admins
      const isAdmin = RBACUtils.hasAnyRole(user, [KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN]);
      const isDoctor = RBACUtils.hasRole(user, KLOQO_ROLES.DOCTOR);

      if (!isAdmin) {
        if (isDoctor) {
          // Doctors can only see their own performance data
          doctorId = user.doctorId || user.id;
        } else if (user.assignedDoctorIds && user.assignedDoctorIds.length > 0) {
          // Nurses/Staff can only see their assigned doctors' data if they provide an ID
          // otherwise we default to the first assigned doctor to prevent cross-doctor visibility.
          if (!doctorId || !user.assignedDoctorIds.includes(doctorId)) {
            doctorId = user.assignedDoctorIds[0];
          }
        }
      }

      const data = await this.getClinicDashboardUseCase.execute(clinicId, {
        startDate: start as string,
        endDate: end as string,
        doctorId: doctorId as string
      });
      res.json(data);
    } catch (error: any) {
      if (error instanceof ClinicNotApprovedError) {
        return res.status(403).json({ error: 'Clinic is not approved by Superadmin' });
      }
      if (error instanceof OnboardingIncompleteError) {
        return res.status(403).json({ error: 'Clinic onboarding is incomplete' });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async getDashboard(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const data = await this.getSuperadminDashboardUseCase.execute({ startDate, endDate });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPunctualityLogs(req: Request, res: Response) {
    try {
      const { doctorId } = req.query;
      const data = await this.getPunctualityLogsUseCase.execute(doctorId as string);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getErrorLogs(req: Request, res: Response) {
    try {
      const { page, limit } = req.query;
      const params = page && limit ? { 
        page: parseInt(page as string), 
        limit: parseInt(limit as string) 
      } : undefined;
      const data = await this.getErrorLogsUseCase.execute(params);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async logError(req: Request, res: Response) {
    try {
      await this.logErrorUseCase.execute(req.body);
      res.status(201).json({ message: 'Error logged successfully' });
    } catch (error: any) {
      console.error('Error logging failed:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getInvestorMetrics(req: Request, res: Response) {
    try {
      const metrics = await this.getInvestorMetricsUseCase.execute();
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
