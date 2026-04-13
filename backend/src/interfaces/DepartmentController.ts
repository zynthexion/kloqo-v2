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
      const { page, limit } = req.query;
      const params = page && limit ? { 
        page: parseInt(page as string), 
        limit: parseInt(limit as string) 
      } : undefined;
      const departments = await this.getAllDepartmentsUseCase.execute(params);
      res.json(departments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async saveDepartment(req: Request, res: Response) {
    try {
      await this.saveDepartmentUseCase.execute(req.body);
      res.json({ message: 'Department saved successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async updateDepartment(req: Request, res: Response) {
    try {
      await this.updateDepartmentUseCase.execute(req.params.id, req.body);
      res.json({ message: 'Department updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteDepartment(req: Request, res: Response) {
    try {
      const { soft = true } = req.query;
      await this.deleteDepartmentUseCase.execute(req.params.id, soft === 'true');
      res.json({ message: 'Department deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
