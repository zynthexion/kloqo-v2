import { Clinic, Doctor } from '../../../packages/shared/src/index';
import { IClinicRepository, IDoctorRepository } from '../domain/repositories';

export class GetPublicDiscoveryUseCase {
  constructor(
    private clinicRepository: IClinicRepository,
    private doctorRepository: IDoctorRepository
  ) {}

  async execute(params?: { 
    clinicIds?: string[];
    lat?: number;
    lng?: number;
    doctorIds?: string[];
  }): Promise<{ clinics: Clinic[]; doctors: Doctor[] }> {
    const { clinicIds, lat, lng, doctorIds } = params || {};

    // 1. Fetch clinics
    const allClinics = await this.clinicRepository.findAll() as Clinic[];
    let targetClinics = allClinics;
    
    // RADIUS filtering (50KM) - Rule 14 (FinOps)
    if (lat !== undefined && lng !== undefined) {
      const RADIUS_KM = 50;
      const DEG_PER_KM = 0.009; // Approx 1 / 111.1
      const deltaLat = RADIUS_KM * DEG_PER_KM;
      const deltaLng = deltaLat / Math.cos(lat * Math.PI / 180);

      const minLat = lat - deltaLat;
      const maxLat = lat + deltaLat;
      const minLng = lng - deltaLng;
      const maxLng = lng + deltaLng;

      targetClinics = allClinics.filter(c => {
        if (!c.latitude || !c.longitude) return false;
        return c.latitude >= minLat && c.latitude <= maxLat && 
               c.longitude >= minLng && c.longitude <= maxLng;
      });
    } else if (clinicIds && clinicIds.length > 0) {
      targetClinics = allClinics.filter(c => clinicIds.includes(c.id));
    } else {
      // Basic filtering to ensure we don't show rejected/deleted clinics
      targetClinics = allClinics.filter(c => 
        (c as any).registrationStatus !== 'Rejected' && 
        c.isDeleted !== true
      );
    }

    const targetClinicIds = targetClinics.map(c => c.id);

    // 2. Fetch doctors
    const allDoctors = await this.doctorRepository.findAll() as Doctor[];
    
    // Base candidates based on clinics or geofencing
    let candidateDoctors = allDoctors.filter(d => {
      const clinic = allClinics.find(c => c.id === d.clinicId);
      const dLat = d.latitude ?? clinic?.latitude;
      const dLng = d.longitude ?? clinic?.longitude;

      if (!dLat || !dLng) return targetClinicIds.includes(d.clinicId!);

      if (lat !== undefined && lng !== undefined) {
        const RADIUS_KM = 50;
        const DEG_PER_KM = 0.009;
        const deltaLat = RADIUS_KM * DEG_PER_KM;
        const deltaLng = deltaLat / Math.cos(lat * Math.PI / 180);

        return dLat >= lat - deltaLat && dLat <= lat + deltaLat && 
               dLng >= lng - deltaLng && dLng <= lng + deltaLng;
      }

      return targetClinicIds.includes(d.clinicId!);
    });

    // ⚡ HISTORY DISCOVERY: Explicitly fetch doctors by ID if requested (Past appointments)
    if (doctorIds && doctorIds.length > 0) {
      const historyDoctors = await this.doctorRepository.findByIds(doctorIds);
      // Merge unique doctors not already in candidates
      const candidateIds = new Set(candidateDoctors.map(d => d.id));
      historyDoctors.forEach(hd => {
        if (!candidateIds.has(hd.id)) {
          candidateDoctors.push(hd);
          
          // Ensure parent clinic is available for coordinate inheritance
          if (!targetClinicIds.includes(hd.clinicId!)) {
            const clinic = allClinics.find(c => c.id === hd.clinicId);
            if (clinic) {
              targetClinics.push(clinic);
              targetClinicIds.push(clinic.id);
            }
          }
        }
      });
    }

    const targetDoctors = candidateDoctors;

    return {
      clinics: targetClinics.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        address: c.address,
        city: c.city,
        district: c.district,
        latitude: c.latitude,
        longitude: c.longitude,
        logoUrl: c.logoUrl,
        registrationStatus: (c as any).registrationStatus,
      }) as any),
      doctors: targetDoctors.map(d => {
        const clinic = allClinics.find(c => c.id === d.clinicId);
        return {
          id: d.id,
          name: d.name,
          specialty: d.specialty,
          department: d.department,
          experience: d.experience,
          degrees: d.degrees,
          avatar: d.avatar,
          clinicId: d.clinicId,
          latitude: d.latitude ?? clinic?.latitude, // Fallback inheritance
          longitude: d.longitude ?? clinic?.longitude,
        } as any;
      })
    };
  }
}
