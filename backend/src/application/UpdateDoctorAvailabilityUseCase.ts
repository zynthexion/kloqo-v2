import { IDoctorRepository, IActivityRepository, IAppointmentRepository, ITransaction } from '../domain/repositories';
import { DoctorAvailability, DoctorOverride, KloqoRole, KLOQO_ROLES } from '../../../packages/shared/src/index';
import { SSEService } from '../domain/services/SSEService';
import { parseClinicTime, getClinicDayOfWeek, parseClinicDate } from '../domain/services/DateUtils';
import { NotificationService } from '../domain/services/NotificationService';

export interface UpdateDoctorAvailabilityRequest {
    doctorId: string;
    availabilitySlots: DoctorAvailability[];
    dateOverrides?: Record<string, DoctorOverride>;
    schedule?: string;
    forceCancelConflicts?: boolean;
    performedBy: { id: string; name: string; role: KloqoRole };
    clinicId: string;
}

/**
 * UpdateDoctorAvailabilityUseCase
 * 
 * CLEAN ARCHITECTURE: This use case is infrastructure-agnostic.
 * It coordinates doctor schedule updates and conflict resolution.
 */
export class UpdateDoctorAvailabilityUseCase {
    constructor(
        private doctorRepo: IDoctorRepository,
        private appointmentRepo: IAppointmentRepository,
        private activityRepo: IActivityRepository,
        private notificationService: NotificationService,
        private sseService: SSEService
    ) {}

    async execute(request: UpdateDoctorAvailabilityRequest): Promise<void> {
        const { doctorId, clinicId, availabilitySlots, dateOverrides, schedule, forceCancelConflicts = false, performedBy } = request;

        const doctor = await this.doctorRepo.findById(doctorId, clinicId);
        if (!doctor) throw new Error('Doctor not found');

        // 1. RBAC Check
        const isSelfInitiated = performedBy.id === doctor.id || performedBy.id === doctor.userId;
        const isAdmin = ([KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN] as KloqoRole[]).includes(performedBy.role);
        const isNurse = (performedBy.role as KloqoRole) === KLOQO_ROLES.NURSE;

        const isStructuralChange = availabilitySlots != null &&
            JSON.stringify(doctor.availabilitySlots) !== JSON.stringify(availabilitySlots);
        
        if (!isAdmin && !isNurse) {
            if (!isSelfInitiated) throw new Error('Unauthorized: Admin/Nurse privileges required.');
            if (isStructuralChange) throw new Error('Unauthorized: Structural changes require Admin privileges.');
        }

        if (isNurse && !isAdmin && isStructuralChange) {
            throw new Error('Unauthorized: Structural changes require Admin privileges.');
        }

        // 2. CONFLICT DISCOVERY (FINOPS: Batch Fetch)
        const conflicts: any[] = [];
        if (dateOverrides) {
            const affectedDates = Object.keys(dateOverrides);
            // ✅ FIX: Resolve N+1 query trap. Fetch all appointments for all dates in one go.
            const allAppointments = await this.appointmentRepo.findByDoctorAndDates(doctorId, clinicId, affectedDates);

            for (const dateStr of affectedDates) {
                const override = dateOverrides[dateStr];
                const baseDate = parseClinicDate(dateStr);
                const activeAppts = allAppointments.filter(a => a.date === dateStr && a.status !== 'Cancelled' && !a.isSystemBlocker);

                if (activeAppts.length === 0) continue;

                if (override.isOff) {
                    conflicts.push(...activeAppts);
                } else if (override.slots) {
                    for (const appt of activeAppts) {
                        const apptTime = parseClinicTime(appt.arriveByTime || appt.time, baseDate);
                        const session = override.slots[appt.sessionIndex || 0];
                        if (!session) {
                            conflicts.push(appt);
                        } else {
                            const sessionStart = parseClinicTime(session.from, baseDate);
                            const sessionEnd = parseClinicTime(session.to, baseDate);
                            if (apptTime < sessionStart || apptTime >= sessionEnd) {
                                conflicts.push(appt);
                            }
                        }
                    }
                }
            }
        }

        if (conflicts.length > 0 && !forceCancelConflicts) {
            const tokenList = conflicts.map(a => `#${a.tokenNumber} (${a.patientName})`).join(', ');
            throw new Error(`ORPHANED_TOKENS_DETECTED: This change affects ${conflicts.length} patient(s): ${tokenList}.`);
        }

        // 3. ATOMIC COMMIT (Infrastructure-agnostic Transaction)
        await this.appointmentRepo.runTransaction(async (txn: ITransaction) => {
            // A. Update Doctor Record
            await this.doctorRepo.update(doctorId, clinicId, {
                availabilitySlots,
                dateOverrides,
                schedule
            }, txn);

            // B. Update Overrides Subcollection
            if (dateOverrides) {
                for (const [dateStr, override] of Object.entries(dateOverrides)) {
                    await this.doctorRepo.saveOverride(doctorId, clinicId, dateStr, override, txn);
                }
            }

            // C. Cancel Conflicts
            if (forceCancelConflicts && conflicts.length > 0) {
                for (const appt of conflicts) {
                    await this.appointmentRepo.update(appt.id, clinicId, {
                        status: 'Cancelled',
                        cancellationReason: 'Doctor Schedule Override'
                    }, txn);
                }
            }
        });

        // 4. POST-COMMIT
        this.doctorRepo.invalidateCache(doctor.id, doctor.clinicId);
        this.sseService.emit('walk_in_created', doctor.clinicId, {
            doctorId,
            type: 'DOCTOR_AVAILABILITY_CHANGED'
        });

        if (forceCancelConflicts && conflicts.length > 0) {
            await Promise.allSettled(
                conflicts.map(appt => 
                    this.notificationService.sendAppointmentCancelledNotification({
                        patientId: appt.patientId,
                        appointmentId: appt.id,
                        doctorName: doctor.name,
                        clinicName: appt.clinicName || 'Clinic',
                        date: appt.date,
                        time: appt.time,
                        clinicId,
                        communicationPhone: appt.communicationPhone,
                        patientName: appt.patientName,
                        reason: 'Doctor Schedule Override'
                    })
                )
            );
        }

        await this.activityRepo.save({
            id: '',
            type: 'SCHEDULING_CHANGE',
            action: isStructuralChange ? 'UPDATE_WEEKLY_AVAILABILITY' : 'UPDATE_DATE_OVERRIDES',
            doctorId,
            clinicId: doctor.clinicId,
            performedBy,
            details: { isStructuralChange, dateOverridesCount: Object.keys(dateOverrides || {}).length },
            timestamp: new Date(),
            expiresAt: null
        });
    }
}
