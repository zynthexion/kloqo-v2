import { Request, Response } from 'express';
import { GetAllPatientsUseCase } from '../application/GetAllPatientsUseCase';
import { SearchPatientsByPhoneUseCase } from '../application/SearchPatientsByPhoneUseCase';
import { GetPatientByIdUseCase } from '../application/GetPatientByIdUseCase';
import { ManagePatientUseCase } from '../application/ManagePatientUseCase';
import { AddRelativeUseCase } from '../application/AddRelativeUseCase';
import { GetLinkPendingPatientsUseCase } from '../application/GetLinkPendingPatientsUseCase';
import { GetPatientsByClinicUseCase } from '../application/GetPatientsByClinicUseCase';
import { GetPatientHistoryUseCase } from '../application/GetPatientHistoryUseCase';
import { GetPatientAppointmentsUseCase } from '../application/GetPatientAppointmentsUseCase';
import { SyncPatientAuthUseCase } from '../application/SyncPatientAuthUseCase';
import { UnlinkRelativeUseCase } from '../application/UnlinkRelativeUseCase';
import { RBACUtils, KLOQO_ROLES, PaginationParams } from '@kloqo/shared';

export class PatientController {
  constructor(
    private getAllPatientsUseCase: GetAllPatientsUseCase,
    private searchPatientsByPhoneUseCase: SearchPatientsByPhoneUseCase,
    private getPatientByIdUseCase: GetPatientByIdUseCase,
    private managePatientUseCase: ManagePatientUseCase,
    private addRelativeUseCase: AddRelativeUseCase,
    private getLinkPendingPatientsUseCase: GetLinkPendingPatientsUseCase,
    private getPatientsByClinicUseCase: GetPatientsByClinicUseCase,
    private getPatientHistoryUseCase: GetPatientHistoryUseCase,
    private getPatientAppointmentsUseCase: GetPatientAppointmentsUseCase,
    private syncPatientAuthUseCase: SyncPatientAuthUseCase,
    private unlinkRelativeUseCase: UnlinkRelativeUseCase
  ) {}

  private validateClinicAccess(req: any, clinicId: string) {
    if (!req.user) return; // Allow public access (if route permits)
    
    // Superadmins have access to all clinics
    if (RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN])) return;

    const hasAccess = req.user.clinicId === clinicId || 
                     (req.user.clinicIds && req.user.clinicIds.includes(clinicId));
    
    if (!hasAccess) {
      const error = new Error('Access Denied: You do not have permission for this clinic.');
      (error as any).status = 403;
      throw error;
    }
  }

  async getAllPatients(req: Request, res: Response) {
    try {
      // Prioritize session clinicId. Only SuperAdmins can override via query.
      const isSuperAdmin = RBACUtils.hasAnyRole((req as any).user, [KLOQO_ROLES.SUPER_ADMIN]);
      const clinicId = (isSuperAdmin && req.query.clinicId) 
        ? (req.query.clinicId as string) 
        : (req as any).user?.clinicId;

      if (!clinicId) {
        return res.status(400).json({ error: 'clinicId is required' });
      }

      this.validateClinicAccess(req, clinicId);

      const { page, limit } = req.query;
      const params: PaginationParams = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 10,
        clinicId: clinicId as string
      };
      
      const patients = await this.getAllPatientsUseCase.execute(params);
      res.json(patients);
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async searchPatients(req: any, res: Response) {
    try {
      const { phone, id } = req.query;
      
      // Zero-Trust: Prioritize session clinicId. Only SuperAdmins can override it via query.
      const isSuperAdmin = RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN]);
      const clinicId = (isSuperAdmin && req.query.clinicId) 
        ? (req.query.clinicId as string) 
        : req.user?.clinicId;

      if (!clinicId) {
        return res.status(400).json({ error: 'clinicId is required in session or query' });
      }

      if (id) {
        const patient = await this.getPatientByIdUseCase.execute(id as string, clinicId);
        return res.json(patient ? [patient] : []);
      }

      if (!phone) {
        return res.status(400).json({ message: 'phone is required (or id)' });
      }
      
      this.validateClinicAccess(req, clinicId);
      const patients = await this.searchPatientsByPhoneUseCase.execute(phone as string, clinicId);
      res.json(patients);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getLinkPending(req: any, res: Response) {
    try {
      // Zero-Trust: Session-based clinicId
      const isSuperAdmin = RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN]);
      const clinicId = (isSuperAdmin && req.query.clinicId) 
        ? (req.query.clinicId as string) 
        : req.user?.clinicId;

      if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
      this.validateClinicAccess(req, clinicId);
      const patients = await this.getLinkPendingPatientsUseCase.execute(clinicId);
      res.json(patients);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async managePatient(req: any, res: Response) {
    try {
      // Zero-Trust: Inject clinicId from session into body payload
      const clinicId = req.user?.clinicId;
      if (!clinicId && !RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN])) {
        return res.status(401).json({ error: 'No clinic context found in session' });
      }

      const payload = { 
        ...req.body, 
        // Only allow body override if SuperAdmin
        clinicId: (RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN]) && req.body.clinicId) 
          ? req.body.clinicId 
          : clinicId 
      };

      if (payload.clinicId) {
        this.validateClinicAccess(req, payload.clinicId);
      }
      
      const patientId = await this.managePatientUseCase.execute(payload);
      res.json({ patientId });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async addRelative(req: any, res: Response) {
    try {
      // Zero-Trust: Enforce session clinicId
      const clinicId = req.user?.clinicId;
      const payload = { 
        ...req.body, 
        clinicId: (RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN]) && req.body.clinicId) 
          ? req.body.clinicId 
          : clinicId 
      };

      if (payload.clinicId) {
        this.validateClinicAccess(req, payload.clinicId);
      }
      const patient = await this.addRelativeUseCase.execute(payload);
      res.json(patient);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getMyClinicPatients(req: any, res: Response) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) return res.status(401).json({ error: 'Unauthorized: Clinic ID not found' });
      
      this.validateClinicAccess(req, clinicId);

      const { page, limit, search } = req.query;
      const params = page && limit ? { 
        page: parseInt(page as string), 
        limit: parseInt(limit as string),
        search: search as string
      } : (search ? { page: 1, limit: 100, search: search as string } : undefined);
      
      const patients = await this.getPatientsByClinicUseCase.execute(clinicId, params);
      res.json(patients);
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async getPatientHistory(req: any, res: Response) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) return res.status(401).json({ error: 'Unauthorized: Clinic ID not found' });
      
      this.validateClinicAccess(req, clinicId);

      const { id } = req.params;
      const history = await this.getPatientHistoryUseCase.execute(id, clinicId);
      res.json(history);
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      if (error.message === 'Patient not found' || error.message.includes('Unauthorized')) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }

  async getMyAppointments(req: any, res: Response) {
    try {
      // For patients, the ID in the database is the patient ID
      const patientId = req.user?.id || req.user?.patientId;
      if (!patientId) {
        return res.status(401).json({ error: 'Unauthorized: Patient ID not found in session' });
      }
      
      const appointments = await this.getPatientAppointmentsUseCase.execute(patientId);
      res.json(appointments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  async syncAuth(req: Request, res: Response) {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const result = await this.syncPatientAuthUseCase.execute(token);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ error: 'Sync failed: ' + error.message });
    }
  }

  async unlinkRelative(req: any, res: Response) {
    try {
      const { primaryId, relativeId } = req.body;
      const clinicId = req.user?.clinicId;
      
      if (clinicId) {
        this.validateClinicAccess(req, clinicId);
      }
      await this.unlinkRelativeUseCase.execute(primaryId, relativeId);
      res.json({ message: 'Success' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPatientProfile(req: any, res: Response) {
    try {
      const { phone, clinicId: queryClinicId } = req.query;
      if (!phone) return res.status(400).json({ error: 'phone is required' });
      
      const isPatientRole = req.user && RBACUtils.hasRole(req.user, KLOQO_ROLES.PATIENT) && !RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN, KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.DOCTOR, KLOQO_ROLES.NURSE, KLOQO_ROLES.RECEPTIONIST, KLOQO_ROLES.PHARMACIST]);

      // IDOR CHECK: Patients can only lookup their own phone numbers.
      if (isPatientRole && req.user.phone !== phone) {
        return res.status(403).json({ error: 'Access Denied: Insufficient Permissions', message: 'Patients may only access their own profiles.' });
      }

      // ✅ FIX: Force search scope to the authenticated user's clinicId. 
      // Prevents "Blind Phone Search" tenant bleed.
      // If patient, they may pass the booking flow's clinicId through the query.
      const clinicId = req.user?.clinicId || (isPatientRole ? queryClinicId : null);
      
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Active clinic context required for profile lookup' });
      }

      const patients = await this.searchPatientsByPhoneUseCase.execute(phone as string, clinicId as string);
      const primary = patients.find(p => p.isPrimary) || (patients.length > 0 ? patients[0] : null);
      const relatives = patients.filter(p => !p.isPrimary && p.id !== primary?.id);
      
      res.json({ patient: primary, relatedProfiles: relatives });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPatientDetail(req: any, res: Response) {
    try {
      const { id } = req.params;
      
      // Zero-Trust: Identify user and clinic context
      const isPatientRole = req.user && RBACUtils.hasRole(req.user, KLOQO_ROLES.PATIENT) && !RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN, KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.DOCTOR, KLOQO_ROLES.NURSE, KLOQO_ROLES.RECEPTIONIST, KLOQO_ROLES.PHARMACIST]);
      const clinicId = req.user?.clinicId || (req.query.clinicId as string);

      // ClinicId is required for staff (tenant isolation), but optional for patients viewing their own data.
      if (!clinicId && !isPatientRole && !RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN])) {
        return res.status(401).json({ error: 'Clinic context required' });
      }

      // Execute use case (patientRepo.findById doesn't strictly need clinicId for the raw fetch)
      const patient = await this.getPatientByIdUseCase.execute(id, clinicId || 'GLOBAL');
      
      if (!patient) return res.status(404).json({ error: 'Patient not found' });

      // IDOR CHECK: Patients can only fetch their own profile or profiles linked via phone.
      if (isPatientRole) {
        const userPhone = req.user.phone;
        const userPatientId = req.user.patientId;

        const isPrimaryOwner = userPatientId && patient.id === userPatientId;
        const isLinkedByPhone = userPhone && (
          patient.phone === userPhone || 
          patient.communicationPhone === userPhone
        );

        if (!isPrimaryOwner && !isLinkedByPhone) {
          console.warn(`[IDOR] Patient ${userPatientId || 'UNSYNCED'} / ${userPhone} attempted to access profile ${id}`);
          return res.status(403).json({ error: 'Access Denied: You do not have permission to view this profile.' });
        }
      }

      res.json(patient);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
