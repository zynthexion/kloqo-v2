import { IDoctorRepository, IClinicRepository, IDepartmentRepository, IAppointmentRepository, IUserRepository } from '../domain/repositories';
import * as admin from 'firebase-admin';
import { KLOQO_ROLES } from '@kloqo/shared';

// Reusing firebase-admin since we have complex querying for appointments
export class GetDoctorDetailsUseCase {
  constructor(
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository,
    private departmentRepo: IDepartmentRepository,
    private appointmentRepo: IAppointmentRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(doctorId: string): Promise<any> {
    // 1. Try finding by ID directly (clinical ID)
    let doctor = await this.doctorRepo.findById(doctorId);

    // 2. IDENTITY FALLBACK (Read-Repair): If not found by document ID, 
    // it's likely a User UID. Fetch user email to enable legacy fallback/repair.
    if (!doctor) {
      const user = await this.userRepo.findById(doctorId);
      if (user) {
        doctor = await this.doctorRepo.findByUserId(user.id as string, user.email);
      }
    }

    if (!doctor) {
      throw new Error('Doctor not found');
    }

    // Hydrate multi-role identity from Users collection
    if (doctor.email) {
      const user = await this.userRepo.findByEmail(doctor.email);
      if (user) {
        doctor.roles = user.roles || (user.role ? [user.role] as any : [KLOQO_ROLES.DOCTOR]);
        doctor.role = (user.role as any) || (doctor.roles?.[0] as any) || KLOQO_ROLES.DOCTOR;
      } else {
        doctor.roles = [KLOQO_ROLES.DOCTOR];
        doctor.role = KLOQO_ROLES.DOCTOR;
      }
    }

    // Get clinic name
    let clinicName = '-';
    if (doctor.clinicId) {
      try {
        const clinic = await this.clinicRepo.findById(doctor.clinicId);
        if (clinic) {
          clinicName = clinic.name;
        }
      } catch (e) {
        console.warn(`Could not fetch clinic for ID ${doctor.clinicId}:`, e);
      }
    }

    // Get department name
    let departmentName = '-';
    if (doctor.department) {
      try {
        // Only try to find by ID if it doesn't look like a direct name (e.g. doesn't have slashes)
        // Firestore .doc() throws if path has odd components
        if (!doctor.department.includes('/')) {
          const dept = await this.departmentRepo.findById(doctor.department);
          if (dept) {
            departmentName = dept.name;
          } else {
            departmentName = doctor.department;
          }
        } else {
          departmentName = doctor.department;
        }
      } catch (e) {
        console.warn(`Could not fetch department for ${doctor.department}:`, e);
        departmentName = doctor.department;
      }
    }

    // ✅ FINOPS: Scoped and limited query (20 docs max) instead of global .findAll()
    try {
      const completedList = await this.appointmentRepo.findCompletedByClinic(doctor.clinicId!, {
        doctorId: doctor.id,
        limit: 20
      });

      const times = completedList
        .map(a => a.completedAt instanceof Date ? a.completedAt : (a.completedAt ? new Date(a.completedAt as any) : null))
        .filter((t): t is Date => t !== null);

      const gaps = [];
      for (let i = 1; i < times.length; i++) {
        const diff = (times[i].getTime() - times[i - 1].getTime()) / 1000 / 60;
        if (diff > 2 && diff < 60) gaps.push(diff);
      }
      
      const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
      if (avg && !isNaN(avg)) {
        await this.doctorRepo.update?.(doctor.id, {
          actualAverageConsultationTime: avg
        });
        doctor.actualAverageConsultationTime = avg;
      }
    } catch (e) {
      console.error('Error calculating average consultation time', e);
    }

    return {
      ...doctor,
      clinicName,
      departmentName,
    };
  }
}
