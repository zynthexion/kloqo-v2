import { Request, Response } from 'express';
import { GetAllDoctorsUseCase } from '../application/GetAllDoctorsUseCase';
import { GetClinicByIdUseCase } from '../application/GetClinicByIdUseCase';
import { GetAvailableSlotsUseCase } from '../application/GetAvailableSlotsUseCase';
import { GetDoctorDetailsUseCase } from '../application/GetDoctorDetailsUseCase';
import { GetPublicQueueStatusUseCase } from '../application/GetPublicQueueStatusUseCase';
import { IAppointmentRepository, IClinicRepository } from '../domain/repositories';
import { Doctor, Clinic } from '@kloqo/shared';

export class PublicBookingController {
  constructor(
    private getAllDoctorsUseCase: GetAllDoctorsUseCase,
    private getClinicByIdUseCase: GetClinicByIdUseCase,
    private getAvailableSlotsUseCase: GetAvailableSlotsUseCase,
    private getDoctorDetailsUseCase: GetDoctorDetailsUseCase,
    private getPublicQueueStatusUseCase: GetPublicQueueStatusUseCase,
    private appointmentRepo: IAppointmentRepository,
    private clinicRepo: IClinicRepository
  ) {}

  /**
   * Returns a list of clinics based on IDs (Bulk hydration).
   */
  async getClinics(req: Request, res: Response) {
    try {
      const { ids } = req.query;
      if (!ids) return res.status(400).json({ error: 'ids are required' });

      const clinicIds = (ids as string).split(',');
      if (clinicIds.length > 20) return res.status(400).json({ error: 'Limit exceeded' });

      const clinics = await this.clinicRepo.findByIds(clinicIds);
      
      const scrubbed = clinics.map((clinic: Clinic) => ({
        id: clinic.id,
        name: clinic.name,
        address: clinic.address,
        logo: clinic.logoUrl,
        settings: {
          allowOnlineBooking: (clinic as any).settings?.allowOnlineBooking
        }
      }));

      res.json({ clinics: scrubbed });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Verifies if a specific slot is still available.
   */
  async checkSlotAvailability(req: Request, res: Response) {
    try {
      const { doctorId } = req.params;
      const { date, time } = req.query;

      if (!doctorId || !date || !time) {
        return res.status(400).json({ error: 'doctorId, date and time are required' });
      }

      const appointments = await this.appointmentRepo.findByDoctorAndDate(doctorId as string, date as string);
      const isTaken = appointments.some(a => a.time === time && a.status !== 'Cancelled');
      
      res.json({ available: !isTaken });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Returns restricted doctor details for public booking.
   */
  async getDoctor(req: Request, res: Response) {
    try {
      const { doctorId } = req.params;
      if (!doctorId) return res.status(400).json({ error: 'doctorId is required' });

      const { doctor } = await this.getDoctorDetailsUseCase.execute(doctorId);
      if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

      // Scrub data
      return res.json({
        doctor: {
          id: doctor.id,
          name: doctor.name,
          specialization: doctor.specialty || doctor.department,
          department: doctor.department,
          avatar: doctor.avatar,
          bio: doctor.bio,
          consultationFee: doctor.consultationFee,
          experience: doctor.experience,
          clinicId: doctor.clinicId,
          availabilitySlots: doctor.availabilitySlots,
          advanceBookingDays: doctor.advanceBookingDays,
          dateOverrides: doctor.dateOverrides
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Returns public slot availability (30-min buffer, breaks hidden).
   */
  async getAvailableSlots(req: Request, res: Response) {
    try {
      const { doctorId } = req.params;
      const { clinicId, date } = req.query;

      if (!doctorId || !clinicId || !date) {
        return res.status(400).json({ error: 'doctorId, clinicId, and date are required' });
      }

      const slots = await this.getAvailableSlotsUseCase.execute({
        doctorId,
        clinicId: clinicId as string,
        date: date as string,
        source: 'patient'
      });
      res.json(slots);
    } catch (error: any) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Returns real-time queue status for a doctor in a clinic.
   */
  async getQueueStatus(req: Request, res: Response) {
    try {
      const { clinicId, doctorId } = req.params;
      const { date } = req.query;

      if (!clinicId || !doctorId || !date) {
        return res.status(400).json({ error: 'clinicId, doctorId, and date are required' });
      }

      const status = await this.getPublicQueueStatusUseCase.execute(
        clinicId,
        doctorId,
        date as string,
        (req as any).user?.patientId
      );
      res.json(status);
    } catch (error: any) {
      console.error(`[PublicBooking] Queue Status Error:`, error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Returns a restricted "Booking Context" for unauthenticated patient users.
   * Includes bare-minimum clinic and doctor data.
   */
  async getBookingContext(req: Request, res: Response) {
    try {
      const { clinicId } = req.params;
      const { date } = req.query; // Optional: get slots for a specific date

      if (!clinicId) {
        return res.status(400).json({ error: 'clinicId is required' });
      }

      // 1. Fetch Clinic Basic Info
      const clinic = await this.getClinicByIdUseCase.execute(clinicId);
      if (!clinic) {
        return res.status(404).json({ error: 'Clinic not found' });
      }

      // 2. Fetch Doctors for this clinic
      const doctorsRaw = await this.getAllDoctorsUseCase.execute(clinicId);
      const doctors = Array.isArray(doctorsRaw) ? doctorsRaw : doctorsRaw.data;

      // 3. For each doctor, scrub sensitive data and potentially fetch slots (if date provided)
      const scrubbedDoctors = await Promise.all(doctors.map(async (doc: Doctor) => {
        // Fetch slots if a date is provided, otherwise return null
        let availableSlots = null;
        if (date && typeof date === 'string') {
          try {
            availableSlots = await this.getAvailableSlotsUseCase.execute({
              doctorId: doc.id,
              clinicId,
              date,
              source: 'patient'
            });
          } catch (slotErr: any) {
            console.warn(`[PublicBooking] Could not fetch slots for doctor ${doc.id}: ${slotErr.message}`);
          }
        }

        return {
          id: doc.id,
          name: doc.name,
          specialization: doc.specialty || doc.department,
          department: doc.department,
          avatar: doc.avatar,
          bio: doc.bio,
          consultationFee: doc.consultationFee,
          experience: doc.experience,
          availableSlots
          // EXPLICITLY REMOVED: phone, email, address, internal metrics, panNumber, etc.
        };
      }));

      return res.json({
        clinic: {
          id: clinic.id,
          name: clinic.name,
          address: clinic.address, // Address is usually public for physical clinics
          logo: clinic.logoUrl,
          settings: {
            allowOnlineBooking: (clinic as any).settings?.allowOnlineBooking
          }
        },
        doctors: scrubbedDoctors
      });

    } catch (error: any) {
      console.error(`[PublicBooking] Error generating context for ${req.params.clinicId}:`, error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
