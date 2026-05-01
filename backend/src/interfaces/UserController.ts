import { Request, Response } from 'express';
import { GetAllUsersUseCase } from '../application/GetAllUsersUseCase';
import { CreateUserUseCase } from '../application/CreateUserUseCase';
import { DeleteUserUseCase } from '../application/DeleteUserUseCase';
import { UpdateUserUseCase } from '../application/UpdateUserUseCase';
import { InviteSuperAdminStaffUseCase } from '../application/InviteSuperAdminStaffUseCase';
import { RegisterInitialSuperAdminUseCase } from '../application/RegisterInitialSuperAdminUseCase';
import { RBACUtils, KLOQO_ROLES } from '@kloqo/shared';

export class UserController {
  constructor(
    private getAllUsersUseCase: GetAllUsersUseCase,
    private createUserUseCase: CreateUserUseCase,
    private deleteUserUseCase: DeleteUserUseCase,
    private updateUserUseCase: UpdateUserUseCase,
    private inviteSuperAdminStaffUseCase: InviteSuperAdminStaffUseCase,
    private registerInitialSuperAdminUseCase: RegisterInitialSuperAdminUseCase
  ) {}

  private validateClinicAccess(req: any, clinicId: string) {
    if (!req.user) return; // Allow public access (if route permits)
    
    // Superadmins and Patients have access across clinics
    if (RBACUtils.hasAnyRole(req.user, [KLOQO_ROLES.SUPER_ADMIN, KLOQO_ROLES.PATIENT])) return;

    const hasAccess = req.user.clinicId === clinicId || 
                     (req.user.clinicIds && req.user.clinicIds.includes(clinicId));
    
    if (!hasAccess) {
      const error = new Error('Access Denied: You do not have permission for this clinic.');
      (error as any).status = 403;
      throw error;
    }
  }

  async registerInitialAdmin(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;
      const user = await this.registerInitialSuperAdminUseCase.execute(email, password, name);
      res.status(201).json(user);
    } catch (error: any) {
      res.status(403).json({ error: error.message });
    }
  }

  async inviteStaff(req: Request, res: Response) {
    try {
      const { email, name, accessibleMenus } = req.body;
      const user = await this.inviteSuperAdminStaffUseCase.execute(email, name, accessibleMenus);
      res.status(201).json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAllUsers(req: Request, res: Response) {
    try {
      const { page, limit } = req.query;
      const user = (req as any).user;
      
      // Zero-Trust: Prioritize session clinicId. Only SuperAdmins can override.
      const isSuperAdmin = RBACUtils.hasAnyRole(user, [KLOQO_ROLES.SUPER_ADMIN]);
      const clinicId = (isSuperAdmin && req.query.clinicId) 
        ? (req.query.clinicId as string) 
        : user?.clinicId;

      if (!clinicId) {
        return res.status(400).json({ error: 'clinicId is required' });
      }

      this.validateClinicAccess(req, clinicId);

      const params = { 
        page: page ? parseInt(page as string) : 1, 
        limit: limit ? parseInt(limit as string) : 10,
        clinicId
      };
      const users = await this.getAllUsersUseCase.execute(params);
      res.json(users);
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async saveUser(req: any, res: Response) {
    try {
      const user = req.user;
      const clinicId = user?.clinicId;
      
      // Zero-Trust: Enforce session clinicId in body
      if (clinicId && !RBACUtils.hasAnyRole(user, [KLOQO_ROLES.SUPER_ADMIN])) {
        req.body.clinicId = clinicId;
      }

      if (req.body.clinicId) {
        this.validateClinicAccess(req, req.body.clinicId);
      }

      const createdUser = await this.createUserUseCase.execute(req.body);
      res.json(createdUser);
    } catch (error: any) {
      if (error.status === 403) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const clinicId = user?.clinicId; // Tenant Guard

      const updatedUser = await this.updateUserUseCase.execute(id, req.body, clinicId);
      res.json(updatedUser);
    } catch (error: any) {
      if (error.name === 'NotFoundError') return res.status(404).json({ error: error.message });
      if (error.name === 'ForbiddenError') return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  async deleteUser(req: any, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user;
      const clinicId = user?.clinicId;

      // Rule 15: We need to pass clinicId to DeleteUserUseCase to ensure the user being deleted
      // belongs to the same clinic as the requester.
      await this.deleteUserUseCase.execute(id, clinicId);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
