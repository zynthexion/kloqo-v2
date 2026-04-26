import { IAppointmentRepository, IDoctorRepository } from '../domain/repositories';
import { Appointment, Doctor } from '../../../packages/shared/src/index';
import { subDays, startOfDay, endOfDay, parse, isWithinInterval } from 'date-fns';

export interface ProviderPerformance {
  doctorId: string;
  name: string;
  clinicalRevenue: number;
  pharmacyRevenue: number;
  totalRevenue: number;
  prescriptionsIssued: number;
  prescriptionsDispensed: number;
  leakageRate: number;
  fulfillmentRate: number;
}

export class GetProviderPerformanceUseCase {
  constructor(
    private doctorRepo: IDoctorRepository,
    private appointmentRepo: IAppointmentRepository
  ) {}

  async execute(clinicId: string, params: { startDate?: string; endDate?: string }): Promise<ProviderPerformance[]> {
    const startDate = params.startDate ? new Date(params.startDate) : subDays(new Date(), 30);
    const endDate = params.endDate ? new Date(params.endDate) : new Date();

    // 1. Fetch All Doctors for the clinic
    const doctorsResult = await this.doctorRepo.findByClinicId(clinicId);
    const doctors = Array.isArray(doctorsResult) ? doctorsResult : (doctorsResult as any).data as Doctor[];
    
    // 2. Fetch All Appointments for the clinic in date range
    const appointments = await this.appointmentRepo.findByClinicId(clinicId);

    // 3. In-Memory Aggregation
    const leaderboard: ProviderPerformance[] = doctors.map((doctor: Doctor) => {
      // ANALYTICS GUARDRAIL: Filter out system blockers (ghost slots) from performance metrics
      // ANALYTICS GUARDRAIL: Filter by clinical date range and strip system blockers
      const docAppts = appointments.filter((a: Appointment) => {
        if (a.doctorId !== doctor.id || a.isDeleted || a.isSystemBlocker) return false;
        
        try {
          // Robust parsing for multiple formats (YYYY-MM-DD vs d MMMM yyyy)
          let aptDate: Date;
          if (a.date.includes('-')) {
            aptDate = parse(a.date, 'yyyy-MM-dd', new Date());
          } else {
            aptDate = parse(a.date, 'd MMMM yyyy', new Date());
          }
          
          if (isNaN(aptDate.getTime())) {
            aptDate = new Date(a.date);
          }

          return isWithinInterval(startOfDay(aptDate), { 
            start: startOfDay(startDate), 
            end: endOfDay(endDate) 
          });
        } catch { return false; }
      });
      
      const completedAppts = docAppts.filter((a: Appointment) => a.status === 'Completed');
      const dispensedAppts = docAppts.filter((a: Appointment) => a.pharmacyStatus === 'dispensed');
      
      const clinicalRevenue = completedAppts.reduce((sum: number, a: Appointment) => sum + (doctor.consultationFee || 0), 0);
      const pharmacyRevenue = dispensedAppts.reduce((sum: number, a: Appointment) => sum + (a.dispensedValue || 0), 0);

      const prescriptionsIssued = docAppts.filter((a: Appointment) => !!a.prescriptionUrl).length;
      const prescriptionsDispensed = dispensedAppts.length;
      
      const fulfillmentRate = prescriptionsIssued > 0 
        ? Math.round((prescriptionsDispensed / prescriptionsIssued) * 100) 
        : 100;

      const leakageRate = 100 - fulfillmentRate;

      return {
        doctorId: doctor.id,
        name: doctor.name,
        clinicalRevenue,
        pharmacyRevenue,
        totalRevenue: clinicalRevenue + pharmacyRevenue,
        prescriptionsIssued,
        prescriptionsDispensed,
        leakageRate,
        fulfillmentRate
      };
    });

    return leaderboard.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }
}
