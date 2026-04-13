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
import { GetPublicDiscoveryUseCase } from '../application/GetPublicDiscoveryUseCase';
import { SyncPatientAuthUseCase } from '../application/SyncPatientAuthUseCase';
import { UnlinkRelativeUseCase } from '../application/UnlinkRelativeUseCase';
import { RBACUtils } from '@kloqo/shared';

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
    private getPublicDiscoveryUseCase: GetPublicDiscoveryUseCase,
    private syncPatientAuthUseCase: SyncPatientAuthUseCase,
    private unlinkRelativeUseCase: UnlinkRelativeUseCase
  ) {}

  private validateClinicAccess(req: any, clinicId: string) {
    if (!req.user) return; // Allow public access (if route permits)
    
    // Superadmins have access to all clinics
    if (RBACUtils.hasAnyRole(req.user, ['superAdmin'])) return;

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
      const { page, limit } = req.query;
      const params = page && limit ? { 
        page: parseInt(page as string), 
        limit: parseInt(limit as string) 
      } : undefined;
      const patients = await this.getAllPatientsUseCase.execute(params);
      res.json(patients);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async searchPatients(req: any, res: Response) {
    try {
      const { phone, id } = req.query;
      
      // Zero-Trust: Prioritize session clinicId. Only SuperAdmins can override it via query.
      const isSuperAdmin = RBACUtils.hasAnyRole(req.user, ['superAdmin']);
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
      const isSuperAdmin = RBACUtils.hasAnyRole(req.user, ['superAdmin']);
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
      if (!clinicId && !RBACUtils.hasAnyRole(req.user, ['superAdmin'])) {
        return res.status(401).json({ error: 'No clinic context found in session' });
      }

      const payload = { 
        ...req.body, 
        // Only allow body override if SuperAdmin
        clinicId: (RBACUtils.hasAnyRole(req.user, ['superAdmin']) && req.body.clinicId) 
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
        clinicId: (RBACUtils.hasAnyRole(req.user, ['superAdmin']) && req.body.clinicId) 
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
      
      const { page, limit, search } = req.query;
      const params = page && limit ? { 
        page: parseInt(page as string), 
        limit: parseInt(limit as string),
        search: search as string
      } : (search ? { page: 1, limit: 100, search: search as string } : undefined);
      
      const patients = await this.getPatientsByClinicUseCase.execute(clinicId, params);
      res.json(patients);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getPatientHistory(req: any, res: Response) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) return res.status(401).json({ error: 'Unauthorized: Clinic ID not found' });
      
      const { id } = req.params;
      const history = await this.getPatientHistoryUseCase.execute(id, clinicId);
      res.json(history);
    } catch (error: any) {
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

  async getPublicDiscovery(req: Request, res: Response) {
    try {
      const clinicIdsParam = req.query.clinicIds as string;
      const clinicIds = clinicIdsParam ? clinicIdsParam.split(',') : undefined;
      
      const doctorIdsParam = req.query.doctorIds as string;
      const doctorIds = doctorIdsParam ? doctorIdsParam.split(',') : undefined;

      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;

      const data = await this.getPublicDiscoveryUseCase.execute({ clinicIds, lat, lng, doctorIds });
      res.json(data);
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
      const { phone } = req.query;
      if (!phone) return res.status(400).json({ error: 'phone is required' });
      
      // ✅ FIX: Force search scope to the authenticated user's clinicId. 
      // Prevents "Blind Phone Search" tenant bleed.
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Active clinic context required for profile lookup' });
      }

      const patients = await this.searchPatientsByPhoneUseCase.execute(phone as string, clinicId);
      const primary = patients.find(p => p.isPrimary) || (patients.length > 0 ? patients[0] : null);
      const relatives = patients.filter(p => !p.isPrimary && p.id !== primary?.id);
      
      res.json({ primary, relatives });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
