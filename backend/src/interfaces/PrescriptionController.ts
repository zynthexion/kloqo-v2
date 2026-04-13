import { Request, Response } from 'express';
import { CompleteAppointmentWithPrescriptionUseCase } from '../application/CompleteAppointmentWithPrescriptionUseCase';
import { IAppointmentRepository } from '../domain/repositories';
import { FirebaseSubscriptionRepository } from '../infrastructure/firebase/FirebaseSubscriptionRepository';
import { RBACUtils, KLOQO_ROLES } from '@kloqo/shared';

export class PrescriptionController {
  constructor(
    private completeAppointmentWithPrescriptionUseCase: CompleteAppointmentWithPrescriptionUseCase,
    private appointmentRepo: IAppointmentRepository,
    private subscriptionRepo: FirebaseSubscriptionRepository,
  ) {}

  async upload(req: any, res: Response) {
    try {
      const { appointmentId, patientId } = req.body;
      const clinicId = req.user?.clinicId;
      const file = req.file;

      if (!appointmentId || !patientId || !clinicId || !file) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          received: { hasApptId: !!appointmentId, hasPatientId: !!patientId, hasClinicId: !!clinicId, hasFile: !!file }
        });
      }

      const result = await this.completeAppointmentWithPrescriptionUseCase.execute({
        appointmentId,
        clinicId,
        fileBuffer: file.buffer,
        fileMimeType: file.mimetype,
        patientId
      });

      res.json({ 
        message: 'Prescription uploaded and appointment completed successfully',
        appointment: result
      });
    } catch (error: any) {
      console.error('Prescription Upload Error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /** GET /clinic/prescriptions?clinicId=&doctorId=&pharmacyStatus=&startDate=&endDate= */
  async getByClinicFiltered(req: Request, res: Response) {
    try {
      const { clinicId, doctorId, pharmacyStatus, startDate, endDate } = req.query;
      if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });

      const filters: any = {};
      if (doctorId) filters.doctorId = doctorId as string;
      if (pharmacyStatus) filters.pharmacyStatus = pharmacyStatus as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const appointments = await this.appointmentRepo.findCompletedByClinic(clinicId as string, filters);

      // Security: strip financial fields if the caller is a nurse or doctor
      const isClinicalRole = RBACUtils.hasAnyRole((req as any).user, [KLOQO_ROLES.NURSE, KLOQO_ROLES.DOCTOR] as Role[]);
      const data = isClinicalRole
        ? appointments.map(({ dispensedValue, abandonedReason, ...rest }) => rest)
        : appointments;

      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** GET /prescriptions/patient/:patientId?clinicId= */
  async getByPatient(req: Request, res: Response) {
    try {
      const { patientId } = req.params;
      const { clinicId } = req.query;
      if (!patientId || !clinicId) return res.status(400).json({ error: 'patientId and clinicId are required' });

      const appointments = await this.appointmentRepo.findCompletedByPatientInClinic(patientId, clinicId as string);
      res.json(appointments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** GET /clinic/prescriptions/stats?clinicId=&period=month */
  async getClinicStats(req: Request, res: Response) {
    try {
      const { clinicId, period } = req.query;
      if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });

      const now = new Date();
      let startDate: Date;
      if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        // default: today
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      }
      const endDate = now;

      const [allDispensed, abandoned, allCompleted] = await Promise.all([
        this.appointmentRepo.findCompletedByClinic(clinicId as string, { pharmacyStatus: 'dispensed', startDate, endDate }),
        this.appointmentRepo.findCompletedByClinic(clinicId as string, { pharmacyStatus: 'abandoned', startDate, endDate }),
        this.appointmentRepo.countByStatus(clinicId as string, 'Completed', startDate, endDate),
      ]);

      // ROI Metrics
      const totalDispensed = allDispensed.length;
      const totalAbandoned = abandoned.length;
      const captureRate = allCompleted > 0 ? Math.round((totalDispensed / allCompleted) * 100) : 0;

      // GMV: Sum of all dispensed bills
      const revenueGenerated = allDispensed.reduce((sum, a) => sum + (a.dispensedValue || 0), 0);

      // Leakage: Sum of abandoned value (dispensedValue would be undefined, so we look at avg or 0)
      const leakageTotal = abandoned.reduce((sum, a) => sum + (a.dispensedValue || 0), 0);

      // Leakage breakdown by reason
      const leakageByReason: Record<string, number> = {};
      for (const appt of abandoned) {
        const reason = appt.abandonedReason || 'Unknown';
        leakageByReason[reason] = (leakageByReason[reason] || 0) + 1;
      }
      const leakageReasons = Object.entries(leakageByReason).map(([reason, count]) => ({ reason, count }));

      // Subscription cost for ROI comparison
      const sub = await this.subscriptionRepo.findByClinicId(clinicId as string);
      const subscriptionCost = sub
        ? parseInt((sub.planId || '0').replace(/[^0-9]/g, ''), 10) || 0
        : 0;

      res.json({
        period,
        totalWritten: allCompleted,
        totalDispensed,
        totalAbandoned,
        captureRate,
        revenueGenerated,
        leakageTotal,
        leakageReasons,
        subscriptionCost,
        roi: revenueGenerated - subscriptionCost,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** PATCH /prescriptions/:appointmentId/dispense — accepts { billValue } */
  async dispense(req: any, res: Response) {
    try {
      const { appointmentId } = req.params;
      const { billValue } = req.body;
      const dispensedBy = req.user?.id;
      const clinicId = req.user?.clinicId;

      if (!appointmentId) return res.status(400).json({ error: 'appointmentId is required' });

      // Rule 15: Strict Tenant Isolation
      const appointment = await this.appointmentRepo.findById(appointmentId);
      if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
      if (appointment.clinicId !== clinicId) {
        return res.status(403).json({ error: 'Unauthorized: Appointment belongs to another clinic' });
      }

      await this.appointmentRepo.update(appointmentId, {
        pharmacyStatus: 'dispensed',
        dispensedBy,
        dispensedAt: new Date(),
        ...(billValue !== undefined && { dispensedValue: Number(billValue) }),
      });

      res.json({ message: 'Prescription marked as dispensed', dispensedValue: billValue });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** PATCH /prescriptions/:appointmentId/abandon — accepts { reason } */
  async abandon(req: any, res: Response) {
    try {
      const { appointmentId } = req.params;
      const { reason } = req.body;
      const clinicId = req.user?.clinicId;

      if (!appointmentId) return res.status(400).json({ error: 'appointmentId is required' });
      if (!reason) return res.status(400).json({ error: 'reason is required to track leakage' });

      // Rule 15: Strict Tenant Isolation
      const appointment = await this.appointmentRepo.findById(appointmentId);
      if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
      if (appointment.clinicId !== clinicId) {
        return res.status(403).json({ error: 'Unauthorized: Appointment belongs to another clinic' });
      }

      await this.appointmentRepo.update(appointmentId, {
        pharmacyStatus: 'abandoned',
        abandonedReason: reason,
      });

      res.json({ message: 'Prescription marked as abandoned', reason });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
