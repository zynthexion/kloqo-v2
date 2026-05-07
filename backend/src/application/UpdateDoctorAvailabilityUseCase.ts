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
    isDryRun?: boolean;
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

    async execute(request: UpdateDoctorAvailabilityRequest): Promise<{ conflictCount: number }> {
        const { doctorId, clinicId, availabilitySlots, dateOverrides, schedule, forceCancelConflicts = false, isDryRun = false, performedBy } = request;

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

        // 🟢 DRY RUN: Stop here and return the preview results
        if (isDryRun) {
            return { conflictCount: conflicts.length };
        }

        // 3. ATOMIC COMMIT (Infrastructure-agnostic Transaction)
        await this.appointmentRepo.runTransaction(async (txn: ITransaction) => {
            // Conflicts are no longer blocking. They are tagged for the Action Center below.
            
            // A. Update Doctor Record
            const updatePayload: any = {};
            if (availabilitySlots !== undefined) updatePayload.availabilitySlots = availabilitySlots;
            if (dateOverrides !== undefined) updatePayload.dateOverrides = dateOverrides;
            if (schedule !== undefined) updatePayload.schedule = schedule;

            console.log(`[UpdateDoctorAvailabilityUseCase] Applying update payload to doctor ${doctorId}:`, JSON.stringify(updatePayload, null, 2));

            await this.doctorRepo.update(doctorId, clinicId, updatePayload, txn);

            // B. Update Overrides Subcollection
            if (dateOverrides) {
                for (const [dateStr, override] of Object.entries(dateOverrides)) {
                    await this.doctorRepo.saveOverride(doctorId, clinicId, dateStr, override, txn);
                }
            }

            // C. Tag Conflicts for Action Center (Non-Blocking)
            if (conflicts.length > 0) {
                const conflictIds = conflicts.map(c => c.id);
                // Tag them all as PENDING
                await this.appointmentRepo.markAsConflict(
                    conflictIds, 
                    clinicId, 
                    {
                        originalTime: 'MULTIPLE', // We can improve this per-appt if needed, but 'PENDING' status is the key trigger
                        originalDate: conflicts[0].date,
                        reason: 'Schedule Override'
                    }, 
                    txn
                );
            }
        });

        // D. Clear Slot Locks (Safety Guard) - Executed outside txn to avoid Read-After-Write errors
        if (dateOverrides) {
            for (const dateStr of Object.keys(dateOverrides)) {
                await this.appointmentRepo.clearSlotLocks(doctorId, dateStr);
            }
        }

        // 4. POST-COMMIT
        this.doctorRepo.invalidateCache(doctor.id, doctor.clinicId);
        this.sseService.emit('appointment_status_changed', doctor.clinicId, {
            type: 'DOCTOR_AVAILABILITY_CHANGED',
            doctorId,
            conflictCount: conflicts.length
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

        return { conflictCount: conflicts.length };
    }
}
