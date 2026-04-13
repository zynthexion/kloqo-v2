import { Request, Response } from 'express';
import { ImpersonateClinicUseCase } from '../application/ImpersonateClinicUseCase';

export class SuperAdminController {
  constructor(
    private impersonateClinicUseCase: ImpersonateClinicUseCase
  ) {}

  /**
   * Generates a tenant-specific custom token for the superAdmin user 
   * to troubleshoot specific clinics.
   */
  async impersonate(req: any, res: Response) {
    try {
      const superAdminId = req.user?.id;
      const { clinicId: targetClinicId } = req.params;

      if (!targetClinicId) {
        return res.status(400).json({ error: 'Target clinic ID is required.' });
      }

      if (!superAdminId) {
        return res.status(401).json({ error: 'Unauthorized: No SuperAdmin ID found in session.' });
      }

      // Execute God Mode logic
      const customToken = await this.impersonateClinicUseCase.execute(superAdminId, targetClinicId);
      
      console.log(`[GOD MODE] Super Admin ${superAdminId} impersonating clinic ${targetClinicId}.`);
      
      res.json({ 
        status: 'success',
        customToken,
        message: `Impersonation token generated for ${targetClinicId}.`
      });
    } catch (error: any) {
      console.warn(`[GOD MODE] Impersonation attempt failed: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }
}
