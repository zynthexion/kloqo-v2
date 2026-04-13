import { Request, Response } from 'express';
import { GetAllUsersUseCase } from '../application/GetAllUsersUseCase';
import { CreateUserUseCase } from '../application/CreateUserUseCase';
import { DeleteUserUseCase } from '../application/DeleteUserUseCase';
import { UpdateUserUseCase } from '../application/UpdateUserUseCase';
import { InviteSuperAdminStaffUseCase } from '../application/InviteSuperAdminStaffUseCase';
import { RegisterInitialSuperAdminUseCase } from '../application/RegisterInitialSuperAdminUseCase';

export class UserController {
  constructor(
    private getAllUsersUseCase: GetAllUsersUseCase,
    private createUserUseCase: CreateUserUseCase,
    private deleteUserUseCase: DeleteUserUseCase,
    private updateUserUseCase: UpdateUserUseCase,
    private inviteSuperAdminStaffUseCase: InviteSuperAdminStaffUseCase,
    private registerInitialSuperAdminUseCase: RegisterInitialSuperAdminUseCase
  ) {}

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
      const { page, limit, clinicId } = req.query;
      const params = { 
        page: page ? parseInt(page as string) : 1, 
        limit: limit ? parseInt(limit as string) : 10,
        clinicId: clinicId as string
      };
      const users = await this.getAllUsersUseCase.execute(params);
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async saveUser(req: Request, res: Response) {
    try {
      const user = await this.createUserUseCase.execute(req.body);
      res.json(user);
    } catch (error: any) {
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

  async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.deleteUserUseCase.execute(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
