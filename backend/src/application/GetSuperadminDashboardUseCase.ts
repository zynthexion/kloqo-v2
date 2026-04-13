import { Clinic, User, Patient, Appointment, TrafficData, SuperadminDashboardData } from '../../../packages/shared/src/index';
import { IClinicRepository, IUserRepository, IPatientRepository, IAppointmentRepository } from '../domain/repositories';
import { SuperadminMetricsService } from '../domain/services/SuperadminMetricsService';

export class GetSuperadminDashboardUseCase {
  constructor(
    private clinicRepo: IClinicRepository,
    private userRepo: IUserRepository,
    private patientRepo: IPatientRepository,
    private appointmentRepo: IAppointmentRepository
  ) {}

  async execute(params?: { startDate?: string; endDate?: string }): Promise<SuperadminDashboardData> {
    try {
      const startDate = params?.startDate ? new Date(params.startDate) : undefined;
      const endDate = params?.endDate ? new Date(params.endDate) : undefined;

      const [
        clinicsResult,
        activeClinics,
        patientsResult,
        totalAppointments,
        appointmentsResult
      ] = await Promise.all([
        this.clinicRepo.findAll(),
        this.clinicRepo.countActive().catch(() => 0),
        this.patientRepo.findAll(),
        this.appointmentRepo.findAll({ page: 1, limit: 1 }).then(res => {
          if (Array.isArray(res)) return res.length;
          return res.total || 0;
        }).catch(() => 0),
        this.appointmentRepo.findAll().catch(() => [])
      ]);

      const clinics = Array.isArray(clinicsResult) ? clinicsResult : (clinicsResult?.data || []);
      const patients = Array.isArray(patientsResult) ? patientsResult : (patientsResult?.data || []);
      const appointments = Array.isArray(appointmentsResult) ? appointmentsResult : (appointmentsResult?.data || []);

      // Calculate metrics with safety
      let retention = 0;
      let mau = 0;
      let growthData: any[] = [];
      let registrationTrends: any[] = [];
      let segmentation = { new: 0, returning: 0 };
      let demographics: { ageGroups: any[]; gender: any[] } = { ageGroups: [], gender: [] };
      let punctuality: any = null;

      try { retention = SuperadminMetricsService.calculateRetention(patients, appointments); } catch (e) { console.error('Retention calculation failed', e); }
      try { mau = SuperadminMetricsService.calculateMAU(appointments, new Date()); } catch (e) { console.error('MAU calculation failed', e); }
      try { growthData = SuperadminMetricsService.generateGrowthData(clinics, patients, appointments, 6); } catch (e) { console.error('Growth data generation failed', e); }
      try { registrationTrends = SuperadminMetricsService.calculateRegistrationTrends(patients, 30); } catch (e) { console.error('Trends calculation failed', e); }
      try { segmentation = SuperadminMetricsService.calculateSegmentation(appointments); } catch (e) { console.error('Segmentation calculation failed', e); }
      try { demographics = SuperadminMetricsService.calculateDemographics(patients); } catch (e) { console.error('Demographics calculation failed', e); }
      try { punctuality = SuperadminMetricsService.calculatePunctualityStats(appointments, startDate, endDate); } catch (e) { console.error('Punctuality calculation failed', e); }

      return { 
        metrics: {
          totalClinics: clinics.length,
          activeClinics: activeClinics || 0,
          totalPatients: patients.length,
          totalAppointments: totalAppointments || 0,
          mau,
          retention
        },
        recentTraffic: [], // Deprecated: analytics collection removed
        growthData,
        patientsAnalytics: {
          registrationTrends,
          segmentation,
          demographics,
          punctuality
        }
      };
    } catch (error: any) {
      console.error('Fatal error in GetSuperadminDashboardUseCase:', error);
      throw error;
    }
  }
}
