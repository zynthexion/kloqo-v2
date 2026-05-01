import { IDoctorRepository, IAppointmentRepository, IActivityRepository, ITransaction } from '../domain/repositories';
import { NotificationService } from '../domain/services/NotificationService';
import { addDays, format, parseISO } from 'date-fns';
import { KloqoRole, KLOQO_ROLES, Appointment } from '../../../packages/shared/src/index';

/**
 * MarkDoctorLeaveUseCase
 * 
 * CLEAN ARCHITECTURE: This use case is infrastructure-agnostic.
 * It manages doctor leave and automatic cancellation of conflicting appointments.
 */
export class MarkDoctorLeaveUseCase {
  constructor(
    private doctorRepo: IDoctorRepository,
    private appointmentRepo: IAppointmentRepository,
    private notificationService: NotificationService,
    private activityRepo: IActivityRepository
  ) {}

  async execute(doctorId: string, clinicId: string, startDate: string, endDate: string | undefined, performedBy: { id: string; name: string; role: KloqoRole }, forceCancelConflicts: boolean = false): Promise<void> {
    const doctor = await this.doctorRepo.findById(doctorId, clinicId);
    if (!doctor) throw new Error('Doctor not found');

    // RBAC
    const isSelfInitiated = performedBy.id === doctor.id || performedBy.id === doctor.userId;
    const isAdmin = ([KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN] as KloqoRole[]).includes(performedBy.role);
    const isNurse = (performedBy.role as KloqoRole) === KLOQO_ROLES.NURSE;

    if (!isAdmin && !isNurse && !isSelfInitiated) throw new Error('Unauthorized');

    const start = startDate;
    const end = endDate || startDate;

    const datesToBlock: string[] = [];
    let current = parseISO(start);
    const finalDate = parseISO(end);
    while (current <= finalDate) {
      datesToBlock.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }

    const updatedOverrides = { ...(doctor.dateOverrides || {}) };
    datesToBlock.forEach(date => { updatedOverrides[date] = { isOff: true }; });
    
    const updatedLeaves = [...(doctor.leaves || [])];
    datesToBlock.forEach(date => {
      if (!updatedLeaves.some(l => l.date === date)) {
        updatedLeaves.push({ date, reason: `Doctor on leave (${isSelfInitiated ? 'Self' : 'Admin'})` });
      }
    });

    const appointmentsToCancel = await this.appointmentRepo.findByDoctorAndDateRange(doctorId, clinicId, start, end);
    const actionableAppointments = appointmentsToCancel.filter(appt => appt.status === 'Confirmed' || appt.status === 'Pending');

    // ATOMIC TRANSACTION
    await this.appointmentRepo.runTransaction(async (txn: ITransaction) => {
        // 1. Cancel Appointments
        for (const appt of actionableAppointments) {
            await this.appointmentRepo.update(appt.id, appt.clinicId, {
                status: 'Cancelled',
                cancellationReason: 'Doctor on leave'
            }, txn);
        }

        // 2. Update Doctor main doc
        await this.doctorRepo.update(doctorId, doctor.clinicId, { 
            dateOverrides: updatedOverrides,
            leaves: updatedLeaves
        }, txn);

        // 3. Update Subcollections
        for (const date of datesToBlock) {
            await this.doctorRepo.saveOverride(doctorId, clinicId, date, { isOff: true }, txn);
            await this.doctorRepo.saveLeave(doctorId, clinicId, date, { date, reason: `Doctor on leave` }, txn);
        }
    });

    this.doctorRepo.invalidateCache(doctorId, doctor.clinicId);

    // ASYNC NOTIFICATIONS
    if (actionableAppointments.length > 0) {
        await Promise.allSettled(
          actionableAppointments.map(appt => 
            this.notificationService.sendAppointmentCancelledNotification({
              patientId: appt.patientId, appointmentId: appt.id, doctorName: doctor.name,
              clinicName: appt.clinicName || 'Clinic', date: appt.date, time: appt.time,
              communicationPhone: appt.communicationPhone, patientName: appt.patientName,
              reason: 'Doctor on leave'
            })
          )
        );

        if (isSelfInitiated) {
          await this.notificationService.sendAdminAlert({
            clinicId: doctor.clinicId,
            title: 'Schedule Alert: Self-Initiated Leave',
            body: `Dr. ${doctor.name} scheduled leave from ${start} to ${end}. ${actionableAppointments.length} appointments cancelled.`
          });
        }
    }

    await this.activityRepo.save({
        id: '', type: 'SCHEDULING_CHANGE', action: 'MARK_LEAVE', doctorId, clinicId: doctor.clinicId, performedBy,
        details: { startDate: start, endDate: end, cancellationCount: actionableAppointments.length, isSelfInitiated },
        timestamp: new Date(), expiresAt: null
    });
  }
}
