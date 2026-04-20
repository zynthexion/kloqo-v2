import { IAppointmentRepository, IDoctorRepository } from '../domain/repositories';
import { Appointment, Doctor, KLOQO_ROLES, RBACUtils } from '@kloqo/shared';

export interface FilterAppointmentsParams {
  patientId?: string;
  status?: string;
  clinicId?: string;
  reviewed?: string;
  includeDoctorData?: string;
  date?: string;
  user: any;
}

export class FilterAppointmentsByTenantUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository
  ) {}

  async execute(params: FilterAppointmentsParams): Promise<Appointment[]> {
    const { patientId, status, clinicId, reviewed, includeDoctorData, date, user } = params;

    // 1. SECURITY: Enforce Tenant/Identity Boundaries
    let effectiveClinicId = clinicId;
    let effectivePatientId = patientId;

    if (user?.role === KLOQO_ROLES.PATIENT) {
      const tokenPatientId = user.patientId || user.id;
      // Patients can only see themselves
      effectivePatientId = tokenPatientId;
      // Clinic scope is optional for patients but prioritized if provided
      effectiveClinicId = clinicId || undefined;
    } else {
      // Staff must be scoped to a clinic
      const isSuperAdmin = RBACUtils.hasAnyRole(user, [KLOQO_ROLES.SUPER_ADMIN]);
      // If not superadmin, force the session clinicId
      if (!isSuperAdmin) {
        effectiveClinicId = user?.clinicId;
      }
    }

    if (!effectiveClinicId && !effectivePatientId) {
      throw new Error('Unauthorized: Query must be scoped to a clinic or a patient profile.');
    }

    // 2. Fetch Base List
    let appointments: Appointment[] = [];
    if (effectivePatientId) {
      appointments = await this.appointmentRepo.findByPatientId(effectivePatientId);
    } else if (effectiveClinicId && date) {
      appointments = await this.appointmentRepo.findByClinicAndDate(effectiveClinicId, date);
    } else if (effectiveClinicId) {
      appointments = await this.appointmentRepo.findByClinicId(effectiveClinicId);
    }

    // 3. Apply Filters
    if (status) {
      const statusList = (status as string).split(',');
      appointments = appointments.filter(a => statusList.includes(a.status));
    }
    if (reviewed !== undefined) {
      const isReviewed = reviewed === 'true';
      appointments = appointments.filter(a => a.reviewed === isReviewed);
    }

    // 4. Hydrate Doctor Data (FinOps: Bulk fetch or cached lookup)
    if (includeDoctorData === 'true' && appointments.length > 0) {
      const doctorCache = new Map<string, Doctor>();
      const hydrated = await Promise.all(appointments.map(async (appt) => {
        if (!appt.doctorId) return appt;
        
        let doctor = doctorCache.get(appt.doctorId);
        if (!doctor) {
          doctor = await this.doctorRepo.findById(appt.doctorId) as Doctor;
          if (doctor) doctorCache.set(appt.doctorId, doctor);
        }

        return {
          ...appt,
          doctorData: doctor ? {
            name: doctor.name,
            specialty: doctor.specialty,
            avatar: doctor.avatar,
            averageConsultingTime: doctor.averageConsultingTime
          } : null
        };
      }));
      return hydrated;
    }

    return appointments;
  }
}
