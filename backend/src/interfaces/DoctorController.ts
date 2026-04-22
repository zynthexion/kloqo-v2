import { Request, Response } from 'express';
import { GetAllDoctorsUseCase } from '../application/GetAllDoctorsUseCase';
import { GetDoctorDetailsUseCase } from '../application/GetDoctorDetailsUseCase';
import { SaveDoctorUseCase } from '../application/SaveDoctorUseCase';
import { DeleteDoctorUseCase } from '../application/DeleteDoctorUseCase';
import { UpdateDoctorStatusUseCase } from '../application/UpdateDoctorStatusUseCase';
import { UpdateDoctorAvailabilityUseCase } from '../application/UpdateDoctorAvailabilityUseCase';
import { UpdateDoctorLeaveUseCase } from '../application/UpdateDoctorLeaveUseCase';
import { ScheduleBreakUseCase } from '../application/ScheduleBreakUseCase';
import { CancelBreakUseCase } from '../application/CancelBreakUseCase';
import { MarkDoctorLeaveUseCase } from '../application/MarkDoctorLeaveUseCase';
import { UpdateDoctorAccessUseCase } from '../application/UpdateDoctorAccessUseCase';
import { RevokeDoctorAccessUseCase } from '../application/RevokeDoctorAccessUseCase';
import { GetDoctorActivitiesUseCase } from '../application/GetDoctorActivitiesUseCase';
import { EditBreakUseCase } from '../application/EditBreakUseCase';
import { KLOQO_ROLES, KloqoRole, RBACUtils } from '@kloqo/shared';

import { GetAvailableSlotsUseCase } from '../application/GetAvailableSlotsUseCase';

export class DoctorController {
  constructor(
    private getAllDoctorsUseCase: GetAllDoctorsUseCase,
    private getDoctorDetailsUseCase: GetDoctorDetailsUseCase,
    private saveDoctorUseCase: SaveDoctorUseCase,
    private deleteDoctorUseCase: DeleteDoctorUseCase,
    private updateDoctorStatusUseCase: UpdateDoctorStatusUseCase,
    private updateDoctorAvailabilityUseCase: UpdateDoctorAvailabilityUseCase,
    private updateDoctorLeaveUseCase: UpdateDoctorLeaveUseCase,
    private scheduleBreakUseCase: ScheduleBreakUseCase,
    private cancelBreakUseCase: CancelBreakUseCase,
    private markDoctorLeaveUseCase: MarkDoctorLeaveUseCase,
    private updateDoctorAccessUseCase: UpdateDoctorAccessUseCase,
    private revokeDoctorAccessUseCase: RevokeDoctorAccessUseCase,
    private getAvailableSlotsUseCase: GetAvailableSlotsUseCase,
    private getDoctorActivitiesUseCase: GetDoctorActivitiesUseCase,
    private editBreakUseCase: EditBreakUseCase
  ) {}

  private validateClinicAccess(req: any, clinicId: string) {
    if (!req.user) return; // Allow public access (if route permits)
    
    // Superadmins and Patients have access to view doctor/clinic details
    if (RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN, KLOQO_ROLES.PATIENT])) return;

    const hasAccess = req.user.clinicId === clinicId || 
                     (req.user.clinicIds && req.user.clinicIds.includes(clinicId));
    
    if (!hasAccess) {
      console.warn(`[DoctorController] Access Denied for user ${req.user.id} to clinic ${clinicId}`);
      const error = new Error('Access Denied: You do not have permission for this clinic.');
      (error as any).status = 403;
      throw error;
    }
  }

  async getAllDoctors(req: Request, res: Response) {
    try {
      const { page, limit, doctorIds } = req.query;
      const ids = doctorIds ? (doctorIds as string).split(',') : undefined;

      // 1. Bulk Detail Fetch (History Hydration)
      if (ids && ids.length > 0) {
        // Limit bulk fetch to prevent heavy scraping
        if (ids.length > 30) return res.status(400).json({ error: 'Cannot fetch more than 30 doctors at once' });
        const doctors = await this.getAllDoctorsUseCase.execute(undefined, undefined, ids);
        return res.json(doctors);
      }

      // 2. Tabulated/Clinic Browse
      // Prioritize session clinicId. Only SuperAdmins or Patients (cross-clinic browsing) can skip this.
      const user = (req as any).user;
      const isSuperAdmin = RBACUtils.hasAnyRole(user, [KLOQO_ROLES.SUPER_ADMIN]);
      const isPatient = RBACUtils.hasAnyRole(user, [KLOQO_ROLES.PATIENT]);
      
      const clinicId = (isSuperAdmin && req.query.clinicId) 
        ? (req.query.clinicId as string) 
        : user?.clinicId;

      if (clinicId) {
        this.validateClinicAccess(req, clinicId);
      }

      const params = page && limit ? { 
        page: parseInt(page as string), 
        limit: parseInt(limit as string) 
      } : undefined;

      const doctors = await this.getAllDoctorsUseCase.execute(clinicId, params);
      res.json(doctors);
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  async getDoctor(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { doctor } = await this.getDoctorDetailsUseCase.execute(id);
      if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

      this.validateClinicAccess(req, doctor.clinicId);

      res.json({ doctor });
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  async saveDoctor(req: any, res: Response) {
    try {
      const user = req.user;
      const docData = req.body;

      if (docData.clinicId) {
        this.validateClinicAccess(req, docData.clinicId);
      } else if (docData.id || docData.userId) {
        // If updating existing, fetch clinic context
        const { doctor } = await this.getDoctorDetailsUseCase.execute(docData.id || docData.userId);
        if (doctor) this.validateClinicAccess(req, doctor.clinicId);
      }

      // 🛡️ RBAC Guard: Only Admin or Self can update doctor meta-data (fees, avg time, etc)
      const isAdmin = RBACUtils.hasAnyRole(user, [KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN]);
      const isSelf = user.id === docData.userId || user.id === docData.id;

      if (!isAdmin && !isSelf) {
        return res.status(403).json({ error: 'Unauthorized: Only Admins or the Doctor themselves can update these settings.' });
      }

      await this.saveDoctorUseCase.execute(docData);
      res.json({ doctor: docData });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteDoctor(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { soft } = req.query;

      // Fetch doctor to check clinic context
      const { doctor } = await this.getDoctorDetailsUseCase.execute(id);
      if (doctor) this.validateClinicAccess(req, doctor.clinicId);

      await this.deleteDoctorUseCase.execute(id, soft === 'true');
      res.status(204).send();
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  async updateConsultationStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, sessionIndex } = req.body;
      
      // Fetch doctor first to check clinic context
      const { doctor } = await this.getDoctorDetailsUseCase.execute(id);
      if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
      
      this.validateClinicAccess(req, doctor.clinicId);

      await this.updateDoctorStatusUseCase.execute({ doctorId: id, status, sessionIndex });
      res.status(204).send();
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  async updateAvailability(req: any, res: Response) {
    try {
      const user = req.user;
      const { availabilitySlots, dateOverrides, forceCancelConflicts = false } = req.body;
      const doctorId = req.params.id || req.body.doctorId;

      if (!doctorId) {
        return res.status(400).json({ error: 'Doctor ID is required' });
      }

      // Fetch doctor to check clinic context
      const { doctor } = await this.getDoctorDetailsUseCase.execute(doctorId);
      if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

      this.validateClinicAccess(req, doctor.clinicId);

      // 🛡️ IDOR GUARD: Doctors can only manage themselves
      if (RBACUtils.hasRole(user, KLOQO_ROLES.DOCTOR) && (user.id !== doctorId && user.userId !== doctorId)) {
        return res.status(403).json({ error: "Access Denied: You are not authorized to modify another doctor's schedule." });
      }

      await this.updateDoctorAvailabilityUseCase.execute({ 
        doctorId, 
        availabilitySlots, 
        dateOverrides, 
        forceCancelConflicts,
        performedBy: {
          id: user.id || user.uid || 'unknown',
          name: user.name || user.email || 'Staff',
          role: (user.roles && user.roles[0]) || user.role || 'staff' as KloqoRole
        }
      });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateLeave(req: any, res: Response) {
    try {
      const user = req.user;
      const { doctorId, clinicId, date, sessions, action } = req.body;

      if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
      this.validateClinicAccess(req, clinicId);
      
      // 🛡️ IDOR GUARD
      if (RBACUtils.hasRole(user, KLOQO_ROLES.DOCTOR) && (user.id !== doctorId && user.userId !== doctorId)) {
        return res.status(403).json({ error: "Access Denied: You are not authorized to modify another doctor's leave." });
      }

      await this.updateDoctorLeaveUseCase.execute({ 
        doctorId, 
        clinicId, 
        date, 
        sessions, 
        action, 
        performedBy: {
          id: user.id || user.uid || 'unknown',
          name: user.name || user.email || 'Staff',
          role: (user.roles && user.roles[0]) || user.role || 'staff' as KloqoRole
        }
      });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async scheduleBreak(req: any, res: Response) {
    try {
      const user = req.user;
      const { doctorId, clinicId, date, startTime, endTime, sessionIndex, reason, isDryRun = false } = req.body;

      if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
      this.validateClinicAccess(req, clinicId);

      const result = await this.scheduleBreakUseCase.execute({
        doctorId,
        clinicId,
        date,
        startTime,
        endTime,
        sessionIndex,
        reason,
        isDryRun,
        performedBy: {
          id:   user.id || user.uid || 'unknown',
          name: user.name || user.email || 'Staff',
          role: (user.roles && user.roles[0]) || user.role || 'staff' as KloqoRole
        }
      });
      res.status(200).json({
        committed:     !isDryRun,   // false = preview only, true = break was written to DB
        breakPeriod:   result.breakPeriod,
        shiftedCount:  result.shiftedCount,
        ghostsCreated: result.ghostsCreated,
        delayMinutes:  result.delayMinutes,
        preview:       result.preview   // Array of { tokenNumber, oldTime, newTime, deltaMinutes }
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async cancelBreak(req: any, res: Response) {
    try {
      const user = req.user;
      // shouldPullForward defaults to false — must be explicitly set to true in UI
      const { doctorId, clinicId, date, breakId, shouldOpenSlots, shouldPullForward = false } = req.body;

      if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
      this.validateClinicAccess(req, clinicId);

      const result = await this.cancelBreakUseCase.execute({
        doctorId,
        clinicId,
        date,
        breakId,
        shouldOpenSlots,
        shouldPullForward,
        performedBy: {
          id:   user.id || user.uid || 'unknown',
          name: user.name || user.email || 'Staff',
          role: (user.roles && user.roles[0]) || user.role || 'staff' as KloqoRole
        }
      });
      res.status(200).json({
        ghostsRemoved:          result.ghostsRemoved,
        appointmentsPulledBack: result.appointmentsPulledBack
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async editBreak(req: any, res: Response) {
    try {
      const user = req.user;
      const { doctorId, clinicId, date, breakId, startTime, endTime } = req.body;

      if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
      this.validateClinicAccess(req, clinicId);

      await this.editBreakUseCase.execute({ 
        doctorId, 
        clinicId, 
        date, 
        breakId, 
        startTime, 
        endTime, 
        performedBy: {
          id: user.id || user.uid || 'unknown',
          name: user.name || user.email || 'Staff',
          role: (user.roles && user.roles[0]) || user.role || 'staff' as KloqoRole
        }
      });
      res.status(204).send();
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  async markLeave(req: any, res: Response) {
    try {
      const user = req.user;
      const { doctorId, startDate, endDate, forceCancelConflicts = false } = req.body;

      // Fetch doctor to check clinic context
      const { doctor } = await this.getDoctorDetailsUseCase.execute(doctorId);
      if (doctor) this.validateClinicAccess(req, doctor.clinicId);

      // 🛡️ IDOR GUARD
      if (RBACUtils.hasRole(user, KLOQO_ROLES.DOCTOR) && (user.id !== doctorId && user.userId !== doctorId)) {
        return res.status(403).json({ error: "Access Denied: You are not authorized to mark leave for another doctor." });
      }

      await this.markDoctorLeaveUseCase.execute(
        doctorId, 
        startDate, 
        endDate, 
        {
          id: user.id || user.uid || 'unknown',
          name: user.name || user.email || 'Staff',
          role: (user.roles && user.roles[0]) || user.role || 'staff' as KloqoRole
        },
        forceCancelConflicts
      );
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getAvailableSlots(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { date } = req.query;
      
      // 🛡️ Robust Context Extraction: Ignore "undefined"/"null" strings passed from frontend templates
      const rawClinicId = req.query.clinicId as string;
      const clinicId = (rawClinicId && rawClinicId !== 'undefined' && rawClinicId !== 'null') 
        ? rawClinicId 
        : req.user?.clinicId;

      if (!clinicId) {
        return res.status(400).json({ error: 'Clinic context is required (missing clinicId)' });
      }

      this.validateClinicAccess(req, clinicId);

      const sessionInfo = await this.getAvailableSlotsUseCase.execute({ 
        doctorId: id, 
        clinicId, 
        date: date as string,
        source: 'staff'
      });
      res.json(sessionInfo);
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      console.error(`[DoctorController] getAvailableSlots Error:`, error.message);
      res.status(400).json({ error: error.message });
    }
  }

  async updateDoctorAccess(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { clinicId, accessibleMenus } = req.body;

      if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
      this.validateClinicAccess(req, clinicId);

      await this.updateDoctorAccessUseCase.execute(id, clinicId, accessibleMenus);
      res.json({ success: true });
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  async revokeDoctorAccess(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { clinicId } = req.body;

      if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
      this.validateClinicAccess(req, clinicId);

      await this.revokeDoctorAccessUseCase.execute(id, clinicId);
      res.json({ success: true, message: 'Doctor access revoked successfully' });
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      if (error.message === 'Doctor not found' || error.message === 'Unauthorized' || error.message === 'No user account found for this doctor' || error.message === 'Doctor does not have an email associated with an account') {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }

  async getActivityLogs(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const clinicId = (req.query.clinicId as string) || (req as any).user?.clinicId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
      this.validateClinicAccess(req, clinicId);

      const logs = await this.getDoctorActivitiesUseCase.execute(id, clinicId, limit);
      res.json(logs);
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }
}
