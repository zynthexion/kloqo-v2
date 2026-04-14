import { format } from 'date-fns';
import { IDoctorRepository, IActivityRepository, IAppointmentRepository } from '../domain/repositories';
import { DoctorAvailability, DoctorOverride, KloqoRole, KLOQO_ROLES } from '../../../packages/shared/src/index';
import { parseClinicTime, getClinicDayOfWeek, parseClinicDate } from '../domain/services/DateUtils';
import { NotificationService } from '../domain/services/NotificationService';
import { db } from '../infrastructure/firebase/config';

export interface UpdateDoctorAvailabilityRequest {
    doctorId: string;
    availabilitySlots: DoctorAvailability[];
    dateOverrides?: Record<string, DoctorOverride>;
    schedule?: string;
    forceCancelConflicts?: boolean;
    performedBy: { id: string; name: string; role: KloqoRole };
}

export class UpdateDoctorAvailabilityUseCase {
    constructor(
        private doctorRepo: IDoctorRepository,
        private appointmentRepo: IAppointmentRepository,
        private activityRepo: IActivityRepository,
        private notificationService: NotificationService
    ) {}

    async execute(request: UpdateDoctorAvailabilityRequest): Promise<void> {
        const { doctorId, availabilitySlots, dateOverrides, schedule, forceCancelConflicts = false, performedBy } = request;

        const doctor = await this.doctorRepo.findById(doctorId);
        if (!doctor) throw new Error('Doctor not found');

        // 1. RBAC Softening (Self-Management Check)
        const isSelfInitiated = performedBy.id === doctor.id || performedBy.id === doctor.userId;
        const isAdmin = ([KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN] as KloqoRole[]).includes(performedBy.role);

        const isStructuralChange = JSON.stringify(doctor.availabilitySlots) !== JSON.stringify(availabilitySlots);
        
        if (!isAdmin) {
            if (!isSelfInitiated) {
                throw new Error('Unauthorized: You can only manage your own schedule or requires Admin privileges.');
            }
            if (isStructuralChange) {
                throw new Error('Unauthorized: Structural schedule changes (Weekly Availability) require Admin privileges.');
            }
        }

        // ── 3. ATOMIC COMMIT ────────────────────────────────────────────────
        //
        // If forceCancelConflicts is TRUE, we must collect all conflicts and 
        // commit them in a single batch alongside the Doctor record.
        //
        const conflicts: any[] = [];
        
        if (dateOverrides) {
            for (const dateStr of Object.keys(dateOverrides)) {
                const override = dateOverrides[dateStr];
                const baseDate = parseClinicDate(dateStr);
                const appointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, dateStr);
                const activeAppts  = appointments.filter(a => a.status !== 'Cancelled' && !a.isSystemBlocker);

                if (activeAppts.length === 0) continue;

                if (override.isOff) {
                    conflicts.push(...activeAppts);
                } else if (override.slots) {
                    for (const appt of activeAppts) {
                        const apptTime = parseClinicTime(appt.arriveByTime || appt.time, baseDate);
                        const session  = override.slots[appt.sessionIndex || 0];
                        
                        if (!session) {
                            conflicts.push(appt);
                            continue;
                        }

                        const sessionStart = parseClinicTime(session.from, baseDate);
                        const sessionEnd   = parseClinicTime(session.to, baseDate);

                        if (apptTime < sessionStart || apptTime >= sessionEnd) {
                            conflicts.push(appt);
                        }
                    }
                }
            }
        }

        // Handle blocked/orphaned tokens
        if (conflicts.length > 0 && !forceCancelConflicts) {
            const tokenList = conflicts.map(a => `#${a.tokenNumber} (${a.patientName})`).join(', ');
            throw new Error(`ORPHANED_TOKENS_DETECTED: This change affects ${conflicts.length} patient(s): ${tokenList}. Please cancel them manually or resolve conflicts.`);
        }

        // Atomic transaction/batch
        // TODO: Implement batch chunking if conflicts.length > 499 (Firestore limit)
        const batch = db.batch();

        // 1. Stage Doctor Update
        const doctorRef = db.collection('doctors').doc(doctorId);
        batch.update(doctorRef, {
            availabilitySlots,
            dateOverrides,
            schedule,
            updatedAt: new Date()
        });

        // 2. Stage Appointments Cancellations (if forced)
        if (forceCancelConflicts && conflicts.length > 0) {
            conflicts.forEach(appt => {
                const apptRef = db.collection('appointments').doc(appt.id);
                batch.update(apptRef, {
                    status: 'Cancelled',
                    cancellationReason: 'Doctor Schedule Override',
                    updatedAt: new Date()
                });
            });
        }

        // 3. Commit Everything
        await batch.commit();

        // 4. POST-COMMIT: Notifications (Non-atomic, triggered only on success)
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
                        communicationPhone: appt.communicationPhone,
                        patientName: appt.patientName,
                        reason: 'Doctor Schedule Override'
                    })
                )
            );
        }

        // Audit Log
        await this.activityRepo.save({
            id: '', // Generated by repo
            type: 'SCHEDULING_CHANGE',
            action: isStructuralChange ? 'UPDATE_WEEKLY_AVAILABILITY' : 'UPDATE_DATE_OVERRIDES',
            doctorId,
            clinicId: doctor.clinicId,
            performedBy,
            details: {
                isStructuralChange,
                dateOverridesCount: Object.keys(dateOverrides || {}).length
            },
            timestamp: new Date(),
            expiresAt: null // Set by repo
        });
    }
}
