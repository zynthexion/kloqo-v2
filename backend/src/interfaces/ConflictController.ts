import { Response } from 'express';
import { GetPendingConflictsUseCase } from '../application/GetPendingConflictsUseCase';
import { ResolveAppointmentConflictUseCase } from '../application/ResolveAppointmentConflictUseCase';
import { RBACUtils, KLOQO_ROLES } from '@kloqo/shared';

export class ConflictController {
  constructor(
    private getPendingConflictsUseCase: GetPendingConflictsUseCase,
    private resolveAppointmentConflictUseCase: ResolveAppointmentConflictUseCase
  ) {}

  private validateClinicAccess(req: any, clinicId: string) {
    if (!req.user) return;
    
    if (RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN])) return;

    const hasAccess = req.user.clinicId === clinicId || 
                     (req.user.clinicIds && req.user.clinicIds.includes(clinicId));
    
    if (!hasAccess) {
      const error = new Error('Access Denied: You do not have permission for this clinic.');
      (error as any).status = 403;
      throw error;
    }
  }

  async getPendingConflicts(req: any, res: Response) {
    try {
      const clinicId = req.user?.clinicId || req.query.clinicId;
      if (!clinicId) {
        return res.status(400).json({ error: 'Clinic ID is required' });
      }

      this.validateClinicAccess(req, clinicId);

      const conflicts = await this.getPendingConflictsUseCase.execute(clinicId);
      res.json(conflicts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async resolveConflict(req: any, res: Response) {
    try {
      const { id } = req.params;
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Clinic ID not found' });
      }

      this.validateClinicAccess(req, clinicId);

      const data = await this.resolveAppointmentConflictUseCase.execute({
        appointmentId: id,
        clinicId,
        action: req.body.action,
        newDate: req.body.newDate,
        newTime: req.body.newTime,
        newSlotIndex: req.body.newSlotIndex,
        newSessionIndex: req.body.newSessionIndex,
        performedBy: {
          id: req.user.id,
          name: req.user.name || 'Staff',
          role: req.user.role
        }
      });

      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
