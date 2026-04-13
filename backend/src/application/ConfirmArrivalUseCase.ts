import { IAppointmentRepository, IClinicRepository } from '../domain/repositories';
import { calculateDistance } from '../../../packages/shared/src/index';
import { UpdateAppointmentStatusUseCase } from './UpdateAppointmentStatusUseCase';

export class ConfirmArrivalUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private clinicRepo: IClinicRepository,
    private updateAppointmentStatusUseCase: UpdateAppointmentStatusUseCase
  ) {}

  async execute(params: {
    appointmentId: string;
    clinicId: string;
    patientLat: number;
    patientLng: number;
  }) {
    const { appointmentId, clinicId, patientLat, patientLng } = params;

    // 1. Fetch the clinic to get its coordinates
    const clinic = await this.clinicRepo.findById(clinicId);
    if (!clinic) {
      throw new Error('Clinic not found');
    }

    if (!clinic.latitude || !clinic.longitude) {
      throw new Error('Clinic location coordinates are not configured properly');
    }

    // 2. Perform Haversine distance check securely on the backend
    const distanceMatches = calculateDistance(
      patientLat,
      patientLng,
      clinic.latitude,
      clinic.longitude
    );

    // Allowing up to 200 meters distance (based on implementation plan)
    if (distanceMatches > 200) {
      throw new Error(`You are ${Math.round(distanceMatches)}m away from the clinic. Please be within 200m to confirm arrival.`);
    }

    // 3. Delegate to the standard status updater
    const updatedAppointment = await this.updateAppointmentStatusUseCase.execute({
      appointmentId,
      clinicId,
      status: 'Confirmed'
    });

    return updatedAppointment;
  }
}
