import { FirebaseAppointmentRepository } from '../infrastructure/firebase/FirebaseAppointmentRepository';
import { FirebaseDoctorRepository } from '../infrastructure/firebase/FirebaseDoctorRepository';
import { SSEService } from '../domain/services/SSEService';
import { QueueBubblingService } from '../domain/services/QueueBubblingService';

async function forceBubbling() {
  const doctorId = 'doc-1776757867561';
  const clinicId = 'F9cIkgVcjXEfI7L63eoK';
  const date = '2026-05-05';
  const sessionIndex = 1;

  console.log(`🚀 Force-triggering Vacuum for ${doctorId} on ${date}, session ${sessionIndex}...`);

  try {
    const appointmentRepo = new FirebaseAppointmentRepository();
    const doctorRepo = new FirebaseDoctorRepository();
    const sseService = new SSEService();
    const queueBubblingService = new QueueBubblingService(appointmentRepo, doctorRepo, sseService);

    await queueBubblingService.reoptimize({
      sessionIndex,
      doctorId,
      clinicId,
      date
    });

    console.log('✅ Vacuum complete! Take a snapshot to verify.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Vacuum failed:', error);
    process.exit(1);
  }
}

forceBubbling();

