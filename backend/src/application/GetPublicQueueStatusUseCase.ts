import { IClinicRepository, IDoctorRepository, IAppointmentRepository } from '../domain/repositories';
import { Appointment, QueueState, compareAppointments, compareAppointmentsClassic } from '../../../packages/shared/src/index';

export interface PublicQueueStatus {
  clinic: {
    id: string;
    name: string;
    tokenDistribution: 'classic' | 'advanced';
    address?: string;
  };
  doctor: {
    id: string;
    name: string;
    consultationStatus: 'In' | 'Out' | string;
    currentSessionIndex?: number;
  };
  queue: {
    arrivedCount: number;
    patientsAhead: number;
    currentToken: string | null;
    yourTurn: boolean;
    isDoctorIn: boolean;
  };
  // To keep parity with what frontend expects
  masterQueue: any[]; 
  currentTokenAppointment: any | null;
}

export class GetPublicQueueStatusUseCase {
  constructor(
    private clinicRepo: IClinicRepository,
    private doctorRepo: IDoctorRepository,
    private appointmentRepo: IAppointmentRepository
  ) {}

  async execute(clinicId: string, doctorId: string, date: string, patientId?: string): Promise<PublicQueueStatus> {
    const [clinic, doctor, appointments] = await Promise.all([
      this.clinicRepo.findById(clinicId),
      this.doctorRepo.findById(doctorId),
      this.appointmentRepo.findByDoctorAndDate(doctorId, date)
    ]);

    if (!clinic || !doctor) {
      throw new Error('Clinic or Doctor not found');
    }

    const tokenDistribution = doctor.tokenDistribution || clinic.tokenDistribution || 'advanced';

    // ANALYTICS GUARDRAIL: Strip system-generated ghost break-blocker records
    // before any queue logic runs. These records exist to block the scheduling
    // engine and must never be visible to patients or counted in queue metrics.
    const realAppointments = appointments.filter(a => !a.isSystemBlocker);

    // Same logic as NurseDashboard but sanitized
    const arrivedQueue = realAppointments
      .filter(apt => apt.status === 'Confirmed' && !apt.isPriority)
      .sort(tokenDistribution === 'advanced' ? compareAppointments : compareAppointmentsClassic);

    const priorityQueue = realAppointments
      .filter(apt => apt.status === 'Confirmed' && apt.isPriority)
      .sort((a, b) => {
        const pA = (a.priorityAt as any)?.seconds || (a.priorityAt ? new Date(a.priorityAt).getTime() / 1000 : 0);
        const pB = (b.priorityAt as any)?.seconds || (b.priorityAt ? new Date(b.priorityAt).getTime() / 1000 : 0);
        return pA - pB;
      });

    const bufferQueue = arrivedQueue.filter(apt => apt.isInBuffer);
    
    let currentConsultation = priorityQueue[0] || bufferQueue[0] || null;

    // Calculate patients ahead for the specific patient
    let patientsAhead = 0;
    let yourTurn = false;
    if (patientId) {
      const yourApt = realAppointments.find(a => a.patientId === patientId && a.status === 'Confirmed');
      if (yourApt) {
        if (currentConsultation?.id === yourApt.id) {
          yourTurn = true;
        } else {
          // Count combined priority + arrived (up to your position)
          const fullQueue = [...priorityQueue, ...arrivedQueue.filter(a => !a.isPriority)];
          const yourIndex = fullQueue.findIndex(a => a.id === yourApt.id);
          if (yourIndex !== -1) {
            patientsAhead = yourIndex;
          }
        }
      }
    }

    return {
      clinic: {
        id: clinic.id,
        name: clinic.name,
        tokenDistribution: tokenDistribution as 'classic' | 'advanced',
        address: clinic.address
      },
      doctor: {
        id: doctor.id,
        name: doctor.name,
        consultationStatus: doctor.consultationStatus || 'Out',
      },
      queue: {
        arrivedCount: arrivedQueue.length + priorityQueue.length,
        patientsAhead,
        currentToken: tokenDistribution === 'classic' 
          ? currentConsultation?.classicTokenNumber?.toString() || null
          : currentConsultation?.tokenNumber || null,
        yourTurn,
        isDoctorIn: doctor.consultationStatus === 'In'
      },
      // Sanitized masterQueue (frontend expects this for some logic)
      masterQueue: arrivedQueue.map(a => ({
        id: a.id,
        tokenNumber: a.tokenNumber,
        classicTokenNumber: a.classicTokenNumber,
        status: a.status,
        isPriority: a.isPriority
      })),
      currentTokenAppointment: currentConsultation ? {
        id: currentConsultation.id,
        tokenNumber: currentConsultation.tokenNumber,
        classicTokenNumber: currentConsultation.classicTokenNumber,
        status: currentConsultation.status
      } : null
    };
  }
}
