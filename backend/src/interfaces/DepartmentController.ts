import { Request, Response } from 'express';
import { GetAllDepartmentsUseCase } from '../application/GetAllDepartmentsUseCase';
import { SaveDepartmentUseCase } from '../application/SaveDepartmentUseCase';
import { UpdateDepartmentUseCase } from '../application/UpdateDepartmentUseCase';
import { DeleteDepartmentUseCase } from '../application/DeleteDepartmentUseCase';

export class DepartmentController {
  constructor(
    private getAllDepartmentsUseCase: GetAllDepartmentsUseCase,
    private saveDepartmentUseCase: SaveDepartmentUseCase,
    private updateDepartmentUseCase: UpdateDepartmentUseCase,
    private deleteDepartmentUseCase: DeleteDepartmentUseCase
  ) {}

  async getAllDepartments(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const clinicId = user?.clinicId || (req.query.clinicId as string);
      
      if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
      const { page, limit } = req.query;
      const params = page && limit ? { 
        page: parseInt(page as string), 
        limit: parseInt(limit as string) 
      } : undefined;
      const departments = await this.getAllDepartmentsUseCase.execute(clinicId, params);
      res.json(departments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async saveDepartment(req: Request, res: Response) {
    try {
      const clinicId = (req as any).user.clinicId;
      await this.saveDepartmentUseCase.execute(clinicId, req.body);
      res.json({ message: 'Department saved successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateDepartment(req: Request, res: Response) {
    try {
      const clinicId = (req as any).user.clinicId;
      await this.updateDepartmentUseCase.execute(clinicId, req.params.id, req.body);
      res.json({ message: 'Department updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteDepartment(req: Request, res: Response) {
    try {
      const soft = req.query.soft as string;
      const clinicId = (req as any).user.clinicId;
      await this.deleteDepartmentUseCase.execute(req.params.id, clinicId, soft === 'true');
      res.json({ message: 'Department deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
