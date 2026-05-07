import { IAppointmentRepository, IDoctorRepository, IClinicRepository, ITransaction } from '../domain/repositories';
import { Appointment } from '../../../packages/shared/src/index';
import { NotificationService } from '../domain/services/NotificationService';
import { SSEService } from '../domain/services/SSEService';
import { TokenStrategyFactory } from '../domain/services/token/TokenStrategyFactory';
import { parse, subMinutes, format } from 'date-fns';

export type ConflictResolutionAction = 'CONFIRM' | 'RESCHEDULE' | 'CANCEL';

export interface ResolveAppointmentConflictRequest {
  appointmentId: string;
  clinicId: string;
  action: ConflictResolutionAction;
  newDate?: string;
  newTime?: string;
  newSlotIndex?: number;
  newSessionIndex?: number;
  performedBy: { id: string; name: string; role: string };
}

/**
 * ResolveAppointmentConflictUseCase
 * 
 * Handles the resolution of a PENDING conflict from the Action Center.
 * Ensures schedule integrity and patient notifications.
 */
export class ResolveAppointmentConflictUseCase {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository,
    private notificationService: NotificationService,
    private sseService: SSEService,
    private tokenStrategyFactory: TokenStrategyFactory
  ) {}

  async execute(request: ResolveAppointmentConflictRequest): Promise<Appointment> {
    const { appointmentId, clinicId, action, newDate, newTime, newSlotIndex, newSessionIndex } = request;

    const appointment = await this.appointmentRepo.findById(appointmentId, clinicId);
    if (!appointment) throw new Error('Appointment not found');
    if (appointment.conflictStatus !== 'PENDING') throw new Error('Appointment is not in a PENDING conflict state');

    const clinic = await this.clinicRepo.findById(clinicId);
    const clinicName = clinic?.name || 'Clinic';

    await this.appointmentRepo.runTransaction(async (txn: ITransaction) => {
      const updates: Partial<Appointment> = {
        conflictStatus: 'RESOLVED',
        updatedAt: new Date()
      };

      if (action === 'CONFIRM' || action === 'RESCHEDULE') {
        if (!newDate || !newTime) throw new Error('New date and time are required for confirmation/rescheduling');
        
        // 1. Generate Token if needed (Rule: New slot/date = New Token)
        const doctor = await this.doctorRepo.findById(appointment.doctorId, clinicId);
        if (!doctor) throw new Error('Doctor not found');
        
        const distributionType = (doctor.tokenDistribution || clinic?.tokenDistribution || 'advanced') as 'classic' | 'advanced';
        const tokenStrategy = this.tokenStrategyFactory.create(distributionType);
        
        const tokenResult = await tokenStrategy.generateBookingToken({
          clinicId,
          doctorId: appointment.doctorId,
          doctorName: doctor.name,
          date: newDate,
          sessionIndex: newSessionIndex || 0,
          slotIndex: newSlotIndex || 0
        }, txn);

        // 2. Create Slot Lock
        const lockId = `${appointment.doctorId}_${newDate}_s${newSessionIndex || 0}_slot${newSlotIndex || 0}`;
        await this.appointmentRepo.createSlotLock(lockId, {
          appointmentId,
          doctorId: appointment.doctorId,
          date: newDate,
          sessionIndex: newSessionIndex || 0,
          slotIndex: newSlotIndex || 0
        }, txn);

        // Calculate Arrive By Time (15 mins before)
        const dateObj = parse(newDate, 'yyyy-MM-dd', new Date());
        let appointmentTimeObj = parse(newTime, 'HH:mm', dateObj);
        
        // If 24h parsing fails, try 12h with AM/PM
        if (isNaN(appointmentTimeObj.getTime())) {
          appointmentTimeObj = parse(newTime, 'hh:mm a', dateObj);
        }

        if (isNaN(appointmentTimeObj.getTime())) {
          throw new Error(`Invalid time value: ${newTime}`);
        }

        const normalizedTime = format(appointmentTimeObj, 'HH:mm');
        const arriveByTimeStr = format(subMinutes(appointmentTimeObj, 15), 'HH:mm');

        updates.date = newDate;
        updates.time = normalizedTime;
        updates.arriveByTime = arriveByTimeStr;
        updates.originalTime = normalizedTime;
        updates.originalArriveByTime = arriveByTimeStr;
        updates.slotIndex = newSlotIndex;
        updates.sessionIndex = newSessionIndex;
        updates.status = 'Pending';
        updates.tokenNumber = (tokenResult?.tokenNumber ?? appointment.tokenNumber) as any;
        updates.numericToken = tokenResult?.numericToken;
        updates.isRescheduled = action === 'RESCHEDULE';

        // Notify patient of the change
        await this.notificationService.sendAppointmentRescheduledNotification({
            patientId: appointment.patientId,
            appointmentId: appointment.id,
            doctorName: appointment.doctorName,
            clinicName,
            oldDate: appointment.date,
            oldTime: appointment.time,
            newDate,
            newTime: format(appointmentTimeObj, 'hh:mm a'),
            clinicId,
            communicationPhone: appointment.communicationPhone,
            patientName: appointment.patientName,
            arriveByTime: format(subMinutes(appointmentTimeObj, 15), 'hh:mm a')
        }).catch(e => console.warn('[ConflictResolution] Notification failed:', e.message));

      } else if (action === 'CANCEL') {
        updates.status = 'Cancelled';
        updates.cancelledBy = 'clinic';
        updates.cancellationReason = 'Schedule Conflict Resolution';

        await this.notificationService.sendAppointmentCancelledNotification({
            patientId: appointment.patientId,
            appointmentId: appointment.id,
            doctorName: appointment.doctorName,
            clinicName,
            date: appointment.date,
            time: appointment.time,
            clinicId,
            communicationPhone: appointment.communicationPhone,
            patientName: appointment.patientName,
            reason: 'Schedule Change'
        }).catch(e => console.warn('[ConflictResolution] Notification failed:', e.message));
      }

      await this.appointmentRepo.update(appointmentId, clinicId, updates, txn);
    });

    // Notify all apps of the resolution
    this.sseService.emit('appointment_status_changed', clinicId, {
      appointmentId,
      newStatus: action === 'CANCEL' ? 'Cancelled' : 'Pending',
      conflictStatus: 'RESOLVED'
    });

    return (await this.appointmentRepo.findById(appointmentId, clinicId))!;
  }
}
