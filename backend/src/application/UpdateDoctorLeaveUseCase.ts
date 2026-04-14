import { IAppointmentRepository, IDoctorRepository, IActivityRepository } from '../domain/repositories';
import { 
    parseClinicTime, 
    getClinicISODateString
} from '../domain/services/DateUtils';
import { KloqoRole } from '../../../packages/shared/src/index';

export interface UpdateDoctorLeaveRequest {
    clinicId: string;
    doctorId: string;
    date: string; // "19 March 2026"
    sessions: Array<{ from: string; to: string; sessionIndex: number }>;
    action: 'MARK_LEAVE' | 'CANCEL_LEAVE';
    performedBy: { id: string; name: string; role: KloqoRole };
}

export class UpdateDoctorLeaveUseCase {
    constructor(
        private appointmentRepo: IAppointmentRepository,
        private doctorRepo: IDoctorRepository,
        private activityRepo: IActivityRepository
    ) {}

    async execute(request: UpdateDoctorLeaveRequest): Promise<void> {
        const { clinicId, doctorId, date, sessions, action, performedBy } = request;

        const doctor = await this.doctorRepo.findById(doctorId);
        if (!doctor) throw new Error('Doctor not found');

        const dateObj = new Date(date);
        const breakPeriods = doctor.breakPeriods || {};
        const dateBreaks = breakPeriods[date] || [];

        let affectedCount = 0;

        if (action === 'MARK_LEAVE') {
            const newBreaks = [...dateBreaks];
            
            for (const session of sessions) {
                const sessionStart = parseClinicTime(session.from, dateObj);
                const sessionEnd = parseClinicTime(session.to, dateObj);
                
                // 1. Create the leave "break"
                const breakId = `leave-${Date.now()}-${session.sessionIndex}`;
                newBreaks.push({
                    id: breakId,
                    startTime: sessionStart.toISOString(),
                    endTime: sessionEnd.toISOString(),
                    startTimeFormatted: session.from,
                    endTimeFormatted: session.to,
                    duration: (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60),
                    sessionIndex: session.sessionIndex,
                    slots: [],
                    type: 'LEAVE',
                    createdAt: new Date().toISOString()
                });

                // 2. Cancel appointments in this session
                const isoDate = getClinicISODateString(dateObj);
                const allAppointments = await this.appointmentRepo.findByClinicAndDate(clinicId, isoDate);
                const sessionAppointments = allAppointments.filter(a => 
                    a.doctorId === doctorId && 
                    a.sessionIndex === session.sessionIndex &&
                    (a.status === 'Pending' || a.status === 'Confirmed')
                );

                for (const appt of sessionAppointments) {
                    await this.appointmentRepo.update(appt.id, {
                        status: 'Cancelled',
                        cancellationReason: 'DOCTOR_LEAVE',
                        updatedAt: new Date()
                    });
                    affectedCount++;
                }
            }

            breakPeriods[date] = newBreaks;
        } else {
            // CANCEL_LEAVE
            const remainingBreaks = dateBreaks.filter((b: any) => {
                const isLeaveInSession = sessions.some(s => s.sessionIndex === b.sessionIndex && b.type === 'LEAVE');
                return !isLeaveInSession;
            });

            // Restore appointments
            const isoDate = getClinicISODateString(dateObj);
            const allAppointments = await this.appointmentRepo.findByClinicAndDate(clinicId, isoDate);
            const cancelledByLeave = allAppointments.filter(a => 
                a.doctorId === doctorId && 
                a.status === 'Cancelled' && 
                a.cancellationReason === 'DOCTOR_LEAVE' &&
                sessions.some(s => s.sessionIndex === a.sessionIndex)
            );

            for (const appt of cancelledByLeave) {
                await this.appointmentRepo.update(appt.id, {
                    status: 'Pending',
                    cancellationReason: undefined,
                    updatedAt: new Date()
                });
                affectedCount++;
            }

            breakPeriods[date] = remainingBreaks;
        }

        await this.doctorRepo.update(doctorId, {
            breakPeriods,
            updatedAt: new Date()
        });

        // Audit Log
        await this.activityRepo.save({
            id: '',
            type: 'SCHEDULING_CHANGE',
            action: action === 'MARK_LEAVE' ? 'UPDATE_LEAVE' : 'CANCEL_LEAVE',
            doctorId,
            clinicId,
            performedBy,
            details: {
                date,
                affectedCount,
                sessions: sessions.map(s => s.sessionIndex)
            },
            timestamp: new Date(),
            expiresAt: null
        });
    }
}
