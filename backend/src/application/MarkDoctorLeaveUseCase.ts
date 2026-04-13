import { IDoctorRepository, IAppointmentRepository, IActivityRepository } from '../domain/repositories';
import { NotificationService } from '../domain/services/NotificationService';
import { db } from '../infrastructure/firebase/config';
import { addDays, format, parseISO } from 'date-fns';
import { Role } from '../../../packages/shared/src/index';

export class MarkDoctorLeaveUseCase {
  constructor(
    private doctorRepo: IDoctorRepository,
    private appointmentRepo: IAppointmentRepository,
    private notificationService: NotificationService,
    private activityRepo: IActivityRepository
  ) {}

  async execute(doctorId: string, startDate: string, endDate: string | undefined, performedBy: { id: string; name: string; role: Role }, forceCancelConflicts: boolean = false): Promise<void> {
    const doctor = await this.doctorRepo.findById(doctorId);
    if (!doctor) throw new Error('Doctor not found');

    // 1. RBAC Softening (Self-Management Check)
    const isSelfInitiated = performedBy.id === doctor.id || performedBy.id === doctor.userId;
    const isAdmin = ['clinicAdmin', 'superAdmin'].includes(performedBy.role);

    if (!isAdmin && !isSelfInitiated) {
        throw new Error('Unauthorized: You can only manage your own schedule or requires Admin privileges.');
    }

    const start = startDate;
    const end = endDate || startDate;

    // 2. Calculate All Dates in Range
    const datesToBlock: string[] = [];
    let current = parseISO(start);
    const finalDate = parseISO(end);

    while (current <= finalDate) {
      datesToBlock.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }

    // 3. Update Doctor dateOverrides (V2 Logic)
    const updatedOverrides = { ...(doctor.dateOverrides || {}) };
    datesToBlock.forEach(date => {
      updatedOverrides[date] = { isOff: true };
    });
    
    // Also maintain legacy leaves array for backward compatibility
    const updatedLeaves = [...(doctor.leaves || [])];
    datesToBlock.forEach(date => {
      if (!updatedLeaves.some(l => l.date === date)) {
        updatedLeaves.push({ date, reason: `Doctor on leave (${isSelfInitiated ? 'Self' : 'Admin'})` });
      }
    });

    await this.doctorRepo.update(doctorId, { 
      dateOverrides: updatedOverrides,
      leaves: updatedLeaves
    });

    // 4. FinOps Query: Fetch all actionable appointments in range
    const snapshot = await db.collection('appointments')
      .where('doctorId', '==', doctorId)
      .where('date', '>=', start)
      .where('date', '<=', end)
      .where('isDeleted', '==', false)
      .get();

    const appointmentsToCancel = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .filter(appt => appt.status === 'Confirmed' || appt.status === 'Pending');

    if (appointmentsToCancel.length > 0) {
        // 5. Safe Batching
        const CHUNK_SIZE = 400;
        for (let i = 0; i < appointmentsToCancel.length; i += CHUNK_SIZE) {
          const chunk = appointmentsToCancel.slice(i, i + CHUNK_SIZE);
          const batch = db.batch();

          chunk.forEach(appt => {
            const docRef = db.collection('appointments').doc(appt.id);
            batch.update(docRef, {
              status: 'Cancelled',
              cancellationReason: 'Doctor on leave',
              updatedAt: new Date()
            });
          });

          await batch.commit();
        }

        // 6. Dispatch Notifications (Async)
        await Promise.allSettled(
          appointmentsToCancel.map(appt => 
            this.notificationService.sendAppointmentCancelledNotification({
              patientId: appt.patientId,
              appointmentId: appt.id,
              doctorName: doctor.name,
              clinicName: appt.clinicName || 'Clinic',
              date: appt.date,
              time: appt.time,
              communicationPhone: appt.communicationPhone,
              patientName: appt.patientName,
              reason: 'Doctor on leave'
            })
          )
        );

        // 7. Active Integrity Alert (Zero-Trust)
        // If a doctor self-initiates a leave that cancels appointments, notify Admins immediately.
        if (isSelfInitiated) {
          await this.notificationService.sendAdminAlert({
            clinicId: doctor.clinicId,
            title: 'Schedule Alert: Self-Initiated Leave',
            body: `Dr. ${doctor.name} just scheduled a leave from ${start} to ${end}. ${appointmentsToCancel.length} appointments were automatically cancelled.`
          });
        }
    }

    // 8. Audit Log
    await this.activityRepo.save({
        id: '',
        type: 'SCHEDULING_CHANGE',
        action: 'MARK_LEAVE',
        doctorId,
        clinicId: doctor.clinicId,
        performedBy,
        details: {
            startDate: start,
            endDate: end,
            cancellationCount: appointmentsToCancel.length,
            isSelfInitiated
        },
        timestamp: new Date(),
        expiresAt: null
    });
  }
}
