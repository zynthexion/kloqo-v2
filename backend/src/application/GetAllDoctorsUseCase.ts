import { IDoctorRepository, IUserRepository } from '../domain/repositories';
import { Doctor, PaginationParams, PaginatedResponse, User, KLOQO_ROLES } from '../../../packages/shared/src/index';

export class GetAllDoctorsUseCase {
  constructor(
    private doctorRepo: IDoctorRepository,
    private userRepo: IUserRepository
  ) {}

  async execute(clinicId?: string, params?: PaginationParams, doctorIds?: string[]): Promise<PaginatedResponse<Doctor> | Doctor[]> {
    let result: PaginatedResponse<Doctor> | Doctor[];
    
    if (doctorIds && doctorIds.length > 0) {
      result = await this.doctorRepo.findByIds(doctorIds);
    } else if (clinicId) {
      result = await this.doctorRepo.findByClinicId(clinicId, params);
    } else {
      result = await this.doctorRepo.findAll(params);
    }

    // Hydrate doctors with roles from the User collection (authoritative source)
    const doctors = Array.isArray(result) ? result : result.data;
    if (doctors.length > 0) {
      // For performance, we fetch all users in the clinic if clinicId is present
      // or match by email for each if it's a global search (rarer).
      const users = clinicId 
        ? await this.userRepo.findAll({ clinicId, page: 1, limit: 100 } as any) 
        : { data: [] }; // Fallback
      
      const userList = Array.isArray(users) ? users : users.data;
      const userMap = new Map<string, User>(
        userList.filter(u => !!u.email).map(u => [u.email!, u])
      );

      doctors.forEach(doctor => {
        if (doctor.email) {
          const user = userMap.get(doctor.email);
          if (user) {
            doctor.roles = user.roles || (user.role ? [user.role] as any : [KLOQO_ROLES.DOCTOR]);
            doctor.role = (doctor.roles?.[0] as any) || KLOQO_ROLES.DOCTOR;
          } else {
            doctor.roles = [KLOQO_ROLES.DOCTOR];
            doctor.role = KLOQO_ROLES.DOCTOR;
          }
        }
      });
    }

    return result;
  }
}
