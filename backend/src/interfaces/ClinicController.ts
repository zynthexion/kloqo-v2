import { Request, Response } from 'express';
import { GetAllClinicsUseCase } from '../application/GetAllClinicsUseCase';
import { GetClinicByIdUseCase } from '../application/GetClinicByIdUseCase';
import { SaveClinicUseCase } from '../application/SaveClinicUseCase';
import { UpdateClinicUseCase } from '../application/UpdateClinicUseCase';
import { DeleteClinicUseCase } from '../application/DeleteClinicUseCase';
import { UpdateClinicStatusUseCase } from '../application/UpdateClinicStatusUseCase';
import { UpdateClinicSettingsUseCase } from '../application/UpdateClinicSettingsUseCase';
import { UpdateWhatsappConfigUseCase } from '../application/UpdateWhatsappConfigUseCase';
import { GenerateShortCodeUseCase } from '../application/GenerateShortCodeUseCase';
import { SyncClinicStatusesUseCase } from '../application/SyncClinicStatusesUseCase';
import { RBACUtils } from '@kloqo/shared';

export class ClinicController {
  constructor(
    private getAllClinicsUseCase: GetAllClinicsUseCase,
    private getClinicByIdUseCase: GetClinicByIdUseCase,
    private saveClinicUseCase: SaveClinicUseCase,
    private updateClinicUseCase: UpdateClinicUseCase,
    private deleteClinicUseCase: DeleteClinicUseCase,
    private updateClinicStatusUseCase: UpdateClinicStatusUseCase,
    private updateClinicSettingsUseCase: UpdateClinicSettingsUseCase,
    private updateWhatsappConfigUseCase: UpdateWhatsappConfigUseCase,
    private generateShortCodeUseCase: GenerateShortCodeUseCase,
    private syncClinicStatusesUseCase: SyncClinicStatusesUseCase
  ) {}

  async syncStatus(req: any, res: Response) {
    try {
      const { date } = req.body;
      // Zero-Trust: Prioritize session clinicId
      const isSuperAdmin = RBACUtils.hasAnyRole(req.user, ['superAdmin']);
      const clinicId = (isSuperAdmin && req.body.clinicId) 
        ? req.body.clinicId 
        : req.user?.clinicId;

      if (!clinicId || !date) {
        return res.status(400).json({ error: 'clinicId (in session or body) and date are required' });
      }
      await this.syncClinicStatusesUseCase.execute(clinicId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAllClinics(req: Request, res: Response) {
    try {
      const { page, limit } = req.query;
      const params = page && limit ? { 
        page: parseInt(page as string), 
        limit: parseInt(limit as string) 
      } : undefined;
      const result = await this.getAllClinicsUseCase.execute(params);
      
      // Standardize response format for the patient app
      if (Array.isArray(result)) {
        res.json({ clinics: result });
      } else {
        res.json(result); // PaginatedResponse already contains 'clinics'
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getClinic(req: Request, res: Response) {
    try {
      const clinic = await this.getClinicByIdUseCase.execute(req.params.id);
      if (!clinic) {
        return res.status(404).json({ error: 'Clinic not found' });
      }
      res.json(clinic);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async saveClinic(req: Request, res: Response) {
    try {
      await this.saveClinicUseCase.execute(req.body);
      res.json({ message: 'Clinic saved successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateClinic(req: Request, res: Response) {
    try {
      await this.updateClinicUseCase.execute(req.params.id, req.body);
      res.json({ message: 'Clinic updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteClinic(req: Request, res: Response) {
    try {
      const { soft = true } = req.query;
      await this.deleteClinicUseCase.execute(req.params.id, soft === 'true');
      res.json({ message: 'Clinic deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateClinicStatus(req: any, res: Response) {
    try {
      const { status } = req.body;
      
      // Zero-Trust: Enforce session clinicId
      const isSuperAdmin = RBACUtils.hasAnyRole(req.user, ['superAdmin']);
      const clinicId = (isSuperAdmin && req.body.clinicId) 
        ? req.body.clinicId 
        : req.user?.clinicId;

      if (!clinicId) {
        return res.status(400).json({ error: 'Clinic context missing' });
      }

      await this.updateClinicStatusUseCase.execute({ clinicId, status });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateSettings(req: Request, res: Response) {
    try {
      await this.updateClinicSettingsUseCase.execute(req.body);
      res.json({ message: 'Clinic settings updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateWhatsappConfig(req: Request, res: Response) {
    try {
      await this.updateWhatsappConfigUseCase.execute(req.body);
      res.json({ message: 'WhatsApp config updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async generateShortCode(req: any, res: Response) {
    try {
      // Zero-Trust: Enforce session clinicId
      const isSuperAdmin = RBACUtils.hasAnyRole(req.user, ['superAdmin']);
      const clinicId = (isSuperAdmin && req.body.clinicId) 
        ? req.body.clinicId 
        : req.user?.clinicId;

      if (!clinicId) {
        return res.status(400).json({ message: 'clinicId context missing' });
      }
      const shortCode = await this.generateShortCodeUseCase.execute(clinicId);
      res.json({ shortCode });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async updateMyClinic(req: any, res: Response) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Clinic ID not found in session' });
      }
      await this.updateClinicUseCase.execute(clinicId, req.body);
      res.json({ message: 'Clinic updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getMyClinic(req: any, res: Response) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Clinic ID not found in session' });
      }
      const clinic = await this.getClinicByIdUseCase.execute(clinicId);
      if (!clinic) {
        return res.status(404).json({ error: 'Clinic not found' });
      }
      res.json(clinic);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
