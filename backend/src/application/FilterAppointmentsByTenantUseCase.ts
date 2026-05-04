import { IAppointmentRepository, IDoctorRepository, IPatientRepository } from '../domain/repositories';
import { Appointment, Doctor, KLOQO_ROLES, RBACUtils } from '@kloqo/shared';
import { getClinicNow } from '@kloqo/shared-core';

export interface FilterAppointmentsParams {
  patientId?: string;
  status?: string;
  clinicId?: string;
  reviewed?: string;
  includeDoctorData?: string;
  date?: string;
  doctor?: string;
  doctorId?: string;
  scope?: 'upcoming' | 'past';
  user: any;
}

export class FilterAppointmentsByTenantUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private patientRepo: IPatientRepository
  ) {}

  async execute(params: FilterAppointmentsParams): Promise<Appointment[]> {
    const { patientId, status, clinicId, reviewed, includeDoctorData, date, doctor, doctorId, user, scope } = params;

    // 1. SECURITY: Enforce Tenant/Identity Boundaries
    let effectiveClinicId = clinicId;
    let effectivePatientIds: string[] = patientId ? [patientId] : [];

    if (RBACUtils.hasRole(user, KLOQO_ROLES.PATIENT)) {
      const tokenPatientId = user.patientId || user.id;
      // patients can see themselves and their relatives
      effectivePatientIds = [tokenPatientId];
      
      // ✅ FIX: Also include any other profiles with the same phone number (Rule: Phone-ownership = Data-ownership)
      if (user.phone) {
        try {
          const profilesByPhone = await this.patientRepo.findByPhone(user.phone, 'SYSTEM');
          profilesByPhone.forEach(p => {
            if (!effectivePatientIds.includes(p.id)) {
              effectivePatientIds.push(p.id);
            }
          });
          console.log(`[FilterAppointments] Added ${profilesByPhone.length} profiles by phone ${user.phone}`);
        } catch (e) {
          console.warn(`[FilterAppointments] Failed to fetch profiles by phone:`, e);
        }
      }
      
      try {
        // Patients can see their own relatives. We use the patient's ID as the 'clinicId' 
        // context for this specific findById call to satisfy the repository signature, 
        // or we pass a placeholder if the repo allows it. 
        // For now, we pass 'SYSTEM' to indicate an internal lookup for auth/relatives.
        // We do this for ALL effective patient IDs to be exhaustive.
        const originalIds = [...effectivePatientIds];
        for (const pid of originalIds) {
          const patientDoc = await this.patientRepo.findById(pid, 'SYSTEM');
          if (patientDoc?.relatedPatientIds && patientDoc.relatedPatientIds.length > 0) {
              patientDoc.relatedPatientIds.forEach(rid => {
                if (!effectivePatientIds.includes(rid)) {
                  effectivePatientIds.push(rid);
                }
              });
          }
        }
        console.log(`[FilterAppointments] Final effectivePatientIds count: ${effectivePatientIds.length}`);
      } catch (e) {
        console.warn(`[FilterAppointments] Failed to fetch relatives:`, e);
      }

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

    if (!effectiveClinicId && effectivePatientIds.length === 0) {
      throw new Error('Unauthorized: Query must be scoped to a clinic or a patient profile.');
    }

    // 2. Fetch Base List
    let appointments: Appointment[] = [];
    // Ensure we have a valid clinic scope for the repo. 
    // If none provided (patient view), we use 'GLOBAL' placeholder if the repo supports it, 
    // or fall back to the first available clinic in the user's session if staff.
    const repoClinicId = effectiveClinicId || 'GLOBAL';

    if (effectivePatientIds.length > 0) {
      appointments = await this.appointmentRepo.findByPatientIds(effectivePatientIds, repoClinicId);
    } else if (effectiveClinicId && (doctor || doctorId) && date) {
      appointments = await this.appointmentRepo.findByDoctorAndDate((doctorId || doctor)!, effectiveClinicId, date);
    } else if (effectiveClinicId && date) {
      appointments = await this.appointmentRepo.findByClinicAndDate(effectiveClinicId, date);
    } else if (effectiveClinicId && (doctor || doctorId)) {
      // Find all by doctor in this clinic
      appointments = await this.appointmentRepo.findAll({ clinicId: effectiveClinicId, doctorId: doctorId || doctor }) as Appointment[];
    } else if (effectiveClinicId) {
      appointments = await this.appointmentRepo.findByClinicId(effectiveClinicId);
    }

    // 3. Apply Filters
    if (scope === 'upcoming') {
      const istNow = getClinicNow();
      istNow.setHours(0, 0, 0, 0);

      appointments = appointments.filter(a => {
        if (['Cancelled', 'Completed', 'No-show'].includes(a.status)) return false;
        
        // Simple string parsing for 'd MMMM yyyy' or ISO
        let apptDate: Date;
        try {
          if (a.date.includes('-')) {
            apptDate = new Date(a.date);
          } else {
            // Fallback for human-readable formats
            apptDate = new Date(a.date);
          }
          apptDate.setHours(0, 0, 0, 0);
        } catch {
          return true; // Keep if unparseable
        }
        
        return apptDate >= istNow;
      });

      // ── DOMAIN SORTING (Rule 16: Dumb Frontend) ──
      // Sort by Date → Time → Token Type (Advanced 'A' before Walk-in 'W') → Token Number
      appointments.sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;

        // Extract numeric time for comparison if possible
        const timeA = a.time || '';
        const timeB = b.time || '';
        if (timeA !== timeB) return timeA.localeCompare(timeB);

        const tokenA = a.tokenNumber || '';
        const tokenB = b.tokenNumber || '';
        
        // Advanced 'A' always comes before Walk-in 'W' for the same slot
        if (tokenA.startsWith('A') && tokenB.startsWith('W')) return -1;
        if (tokenA.startsWith('W') && tokenB.startsWith('A')) return 1;

        const numA = parseInt(tokenA.replace(/\D/g, '') || '0', 10);
        const numB = parseInt(tokenB.replace(/\D/g, '') || '0', 10);
        return numA - numB;
      });
    } else if (status) {
      // Normalize: Express parses ?status=A&status=B as string[] but ?status=A,B as string
      const statusList: string[] = Array.isArray(status)
        ? status as string[]
        : (status as string).split(',');
      appointments = appointments.filter(a => statusList.includes(a.status));
    }
    if (reviewed !== undefined) {
      const isReviewed = reviewed === 'true';
      appointments = appointments.filter(a => a.reviewed === isReviewed);
    }

    // 4. Hydrate Doctor Data (FinOps: Bulk fetch)
    if (includeDoctorData === 'true' && appointments.length > 0) {
      // Group unique doctor IDs by clinicId to satisfy tenant-scoped repository
      const clinicToDoctorIds = new Map<string, Set<string>>();
      appointments.forEach(a => {
        if (!a.doctorId) return;
        if (!clinicToDoctorIds.has(a.clinicId)) clinicToDoctorIds.set(a.clinicId, new Set());
        clinicToDoctorIds.get(a.clinicId)!.add(a.doctorId);
      });

      // Bulk fetch doctors for each clinic
      const doctorCache = new Map<string, Doctor>();
      await Promise.all(
        Array.from(clinicToDoctorIds.entries()).map(async ([cId, docIds]) => {
          const doctors = await this.doctorRepo.findByIds(Array.from(docIds), cId);
          doctors.forEach(d => doctorCache.set(`${cId}_${d.id}`, d));
        })
      );

      // Map back to appointments
      return appointments.map(appt => {
        if (!appt.doctorId) return appt;
        const doctor = doctorCache.get(`${appt.clinicId}_${appt.doctorId}`);
        return {
          ...appt,
          doctorData: doctor ? {
            name: doctor.name,
            specialty: doctor.specialty,
            avatar: doctor.avatar,
            averageConsultingTime: doctor.averageConsultingTime
          } : null
        };
      });
    }

    return appointments;
  }
}
