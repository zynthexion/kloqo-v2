import { Request, Response } from 'express';
import { GetAllAppointmentsUseCase } from '../application/GetAllAppointmentsUseCase';
import { GetNurseDashboardUseCase } from '../application/GetNurseDashboardUseCase';
import { UpdateAppointmentStatusUseCase } from '../application/UpdateAppointmentStatusUseCase';
import { CreateWalkInAppointmentUseCase } from '../application/CreateWalkInAppointmentUseCase';
import { BookAdvancedAppointmentUseCase } from '../application/BookAdvancedAppointmentUseCase';
import { GetAvailableSlotsUseCase } from '../application/GetAvailableSlotsUseCase';
import { DeleteAppointmentUseCase } from '../application/DeleteAppointmentUseCase';
import { SendBookingLinkUseCase } from '../application/SendBookingLinkUseCase';
import { GetWalkInEstimateUseCase } from '../application/GetWalkInEstimateUseCase';
import { GetWalkInPreviewUseCase } from '../application/GetWalkInPreviewUseCase';
import { ConfirmArrivalUseCase } from '../application/ConfirmArrivalUseCase';
import { FilterAppointmentsByTenantUseCase } from '../application/FilterAppointmentsByTenantUseCase';
import { Appointment, Doctor } from '../../../packages/shared/src/index';
import { IAppointmentRepository, IDoctorRepository } from '../domain/repositories';
import { ClinicNotApprovedError, OnboardingIncompleteError, SlotAlreadyBookedError, DuplicateBookingError } from '../domain/errors';
import { RBACUtils, KLOQO_ROLES } from '@kloqo/shared';

export class AppointmentController {
  constructor(
    private getAllAppointmentsUseCase: GetAllAppointmentsUseCase,
    private getNurseDashboardUseCase: GetNurseDashboardUseCase,
    private updateAppointmentStatusUseCase: UpdateAppointmentStatusUseCase,
    private createWalkInAppointmentUseCase: CreateWalkInAppointmentUseCase,
    private bookAdvancedAppointmentUseCase: BookAdvancedAppointmentUseCase,
    private getAvailableSlotsUseCase: GetAvailableSlotsUseCase,
    private deleteAppointmentUseCase: DeleteAppointmentUseCase,
    private sendBookingLinkUseCase: SendBookingLinkUseCase,
    private getWalkInEstimateUseCase: GetWalkInEstimateUseCase,
    private getWalkInPreviewUseCase: GetWalkInPreviewUseCase,
    private confirmArrivalUseCase: ConfirmArrivalUseCase,
    private filterAppointmentsUseCase: FilterAppointmentsByTenantUseCase,
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository
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

  async confirmArrival(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { lat, lng } = req.body;
      const clinicId = req.user?.clinicId;

      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (lat === undefined || lng === undefined) {
        return res.status(400).json({ error: 'Latitude (lat) and Longitude (lng) are required for arrival confirmation.' });
      }

      this.validateClinicAccess(req, clinicId);

      const data = await this.confirmArrivalUseCase.execute({
        appointmentId: id,
        clinicId,
        patientLat: Number(lat),
        patientLng: Number(lng)
      });
      res.status(200).json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async sendBookingLink(req: any, res: Response) {
    try {
      const { phone, patientName } = req.body;
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Clinic ID not found' });
      }
      this.validateClinicAccess(req, clinicId);
      await this.sendBookingLinkUseCase.execute({ phone, clinicId, patientName });
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAllAppointments(req: Request, res: Response) {
    try {
      const { page, limit } = req.query;
      const params = page && limit ? { 
        page: parseInt(page as string), 
        limit: parseInt(limit as string) 
      } : undefined;
      const appointments = await this.getAllAppointmentsUseCase.execute(params);
      res.json(appointments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getNurseDashboard(req: any, res: Response) {
    try {
      const { clinicId, date, page, limit } = req.query;
      if (!clinicId || !date) {
        console.log('[DASHBOARD_DEBUG] Missing params:', { clinicId, date });
        return res.status(400).json({ message: 'clinicId and date are required' });
      }
      this.validateClinicAccess(req, clinicId as string);
      const assignedDoctorIds = (req as any).user?.assignedDoctorIds;
      const pagination = page && limit ? { page: parseInt(page as string), limit: parseInt(limit as string) } : undefined;
      
      console.log('[DASHBOARD_DEBUG] Executing for:', { clinicId, date, assignedDoctorIds, pagination });
      const data = await this.getNurseDashboardUseCase.execute(clinicId as string, date as string, assignedDoctorIds, pagination);

      res.json(data);
    } catch (error: any) {
      if (error instanceof ClinicNotApprovedError) {
        return res.status(403).json({ message: 'Clinic is not approved by Superadmin' });
      }
      if (error instanceof OnboardingIncompleteError) {
        return res.status(403).json({ message: 'Clinic onboarding is incomplete' });
      }
      res.status(500).json({ message: error.message });
    }
  }

  async updateStatus(req: any, res: Response) {
    try {
      const { id } = req.params;
      const { status, time, isPriority } = req.body;
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Clinic ID not found' });
      }
      this.validateClinicAccess(req, clinicId);

      // 🛡️ SECURITY: IDR-01 Ownership Guard
      if (req.user?.role === KLOQO_ROLES.PATIENT) {
        const appointment = await this.appointmentRepo.findById(id);
        if (!appointment || appointment.patientId !== (req.user.id || req.user.patientId)) {
          return res.status(403).json({ error: 'Access Denied: You do not own this appointment.' });
        }
      }

      const data = await this.updateAppointmentStatusUseCase.execute({ 
        appointmentId: id, 
        status,
        clinicId,
        time,
        isPriority
      });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async createWalkIn(req: any, res: Response) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Clinic ID not found' });
      }
      this.validateClinicAccess(req, clinicId);
      const data = await this.createWalkInAppointmentUseCase.execute({ ...req.body, clinicId });
      res.status(201).json(data);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async bookAdvanced(req: any, res: Response) {
    try {
      const { clinicId } = req.body;
      console.log('[BOOKING_ADVANCED] Initial Request:', { body: req.body, userClinicId: req.user?.clinicId });
      
      if (clinicId) {
        this.validateClinicAccess(req, clinicId);
      }
      const appointment = await this.bookAdvancedAppointmentUseCase.execute(req.body);
      res.status(201).json(appointment);
    } catch (error: any) {
      if (error instanceof SlotAlreadyBookedError) {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof DuplicateBookingError) {
        return res.status(400).json({ error: error.message });
      }
      
      // SECURITY FIX: Never expose stack traces or raw error messages to clients.
      console.error('[bookAdvanced error]', error.stack || error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async getAvailableSlots(req: any, res: Response) {
    try {
      const { doctorId, date } = req.query;
      const clinicId = req.user?.clinicId;
      
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Clinic ID not found' });
      }
      this.validateClinicAccess(req, clinicId);
      
      if (!doctorId || !date) {
        return res.status(400).json({ message: 'doctorId and date are required' });
      }
      // Staff route: 15-minute booking buffer
      const sessionInfo = await this.getAvailableSlotsUseCase.execute({
        doctorId: doctorId as string,
        clinicId: clinicId as string,
        date: date as string,
        source: 'staff'
      });
      res.json(sessionInfo);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }


  /**
   * Generic /book endpoint — delegates to bookAdvancedAppointmentUseCase.
   * BookAppointmentUseCase (legacy generic) has been removed (YAGNI).
   */
  async book(req: any, res: Response) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Clinic ID not found' });
      }
      this.validateClinicAccess(req, clinicId);
      const appointment = await this.bookAdvancedAppointmentUseCase.execute({ ...req.body, clinicId });
      res.status(201).json(appointment);
    } catch (error: any) {
      if (error instanceof SlotAlreadyBookedError) {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof DuplicateBookingError) {
        return res.status(400).json({ error: error.message });
      }
      
      console.error('[book error]', error.stack || error.message);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }

  async getClinicAppointments(req: any, res: Response) {
    try {
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Clinic ID not found in session' });
      }
      this.validateClinicAccess(req, clinicId);
      const { doctorId, date, status } = req.query;
      
      let appointments: Appointment[] = [];
      if (doctorId && date) {
        appointments = await this.appointmentRepo.findByDoctorAndDate(doctorId as string, date as string);
      } else if (date) {
        appointments = await this.appointmentRepo.findByClinicAndDate(clinicId, date as string);
      } else {
        appointments = await this.appointmentRepo.findByClinicId(clinicId);
      }

      if (status) {
        // Normalize: Express parses ?status=A&status=B as string[] but ?status=A,B as string
        const statusList: string[] = Array.isArray(status)
          ? status as string[]
          : (status as string).split(',');
        appointments = appointments.filter(a => statusList.includes(a.status));
      }

      res.json(appointments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteAppointment(req: any, res: Response) {
    try {
      const { id } = req.params;
      const clinicId = req.user?.clinicId;
      if (!clinicId) {
        return res.status(401).json({ error: 'Unauthorized: Clinic ID not found' });
      }
      this.validateClinicAccess(req, clinicId);

      // 🛡️ SECURITY: IDR-01 Ownership Guard
      if (req.user?.role === KLOQO_ROLES.PATIENT) {
        const appointment = await this.appointmentRepo.findById(id);
        if (!appointment || appointment.patientId !== (req.user.id || req.user.patientId)) {
          return res.status(403).json({ error: 'Access Denied: You do not own this appointment.' });
        }
      }

      await this.deleteAppointmentUseCase.execute({ appointmentId: id, clinicId });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getWalkInEstimate(req: any, res: Response) {
    try {
      const { doctorId, date, force } = req.query;
      const clinicId = req.user?.clinicId;
      if (!clinicId) return res.status(401).json({ error: 'Unauthorized' });
      this.validateClinicAccess(req, clinicId);
      
      const data = await this.getWalkInEstimateUseCase.execute({
        clinicId,
        doctorId: doctorId as string,
        date: date as string,
        force: force === 'true'
      });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getWalkInPreview(req: any, res: Response) {
    try {
      const { doctorId, date } = req.query;
      const clinicId = req.user?.clinicId;
      if (!clinicId) return res.status(401).json({ error: 'Unauthorized' });
      this.validateClinicAccess(req, clinicId);
      
      const data = await this.getWalkInPreviewUseCase.execute({
        clinicId,
        doctorId: doctorId as string,
        date: date as string
      });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }


  async getAppointments(req: any, res: Response) {
    try {
      console.log('[APPOINTMENTS_DEBUG] Incoming query:', req.query);
      const appointments = await this.filterAppointmentsUseCase.execute({
        ...req.query,
        user: req.user
      });
      console.log('[APPOINTMENTS_DEBUG] Results count:', appointments?.length || 0);
      res.json({ appointments });
    } catch (error: any) {
      if (error.message.includes('Unauthorized') || error.message.includes('Access Denied')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  async checkSlot(req: Request, res: Response) {
    try {
      const { doctorId, date, time } = req.query;
      if (!doctorId || !date || !time) {
        return res.status(400).json({ error: 'doctorId, date and time are required' });
      }
      const appointments = await this.appointmentRepo.findByDoctorAndDate(doctorId as string, date as string);
      const isTaken = appointments.some(a => a.time === time && a.status !== 'Cancelled');
      res.json({ available: !isTaken });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

