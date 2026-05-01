import { IAppointmentRepository, IDoctorRepository, IActivityRepository, ITransaction } from '../domain/repositories';
import { 
    parseClinicTime, 
    getClinicISODateString
} from '../domain/services/DateUtils';
import { KloqoRole } from '../../../packages/shared/src/index';

export interface UpdateDoctorLeaveRequest {
    clinicId: string;
    doctorId: string;
    date: string;
    sessions: Array<{ from: string; to: string; sessionIndex: number }>;
    action: 'MARK_LEAVE' | 'CANCEL_LEAVE';
    performedBy: { id: string; name: string; role: KloqoRole };
}

/**
 * UpdateDoctorLeaveUseCase
 * 
 * CLEAN ARCHITECTURE: This use case is infrastructure-agnostic.
 * It manages doctor leave at the session level.
 */
export class UpdateDoctorLeaveUseCase {
    constructor(
        private appointmentRepo: IAppointmentRepository,
        private doctorRepo: IDoctorRepository,
        private activityRepo: IActivityRepository
    ) {}

    async execute(request: UpdateDoctorLeaveRequest): Promise<void> {
        const { clinicId, doctorId, date, sessions, action, performedBy } = request;

        const doctor = await this.doctorRepo.findById(doctorId, clinicId);
        if (!doctor) throw new Error('Doctor not found');

        const dateObj = new Date(date);
        const breakPeriods = doctor.breakPeriods || {};
        const dateBreaks = breakPeriods[date] || [];

        let affectedCount = 0;
        const newBreaks = action === 'MARK_LEAVE' ? [...dateBreaks] : dateBreaks.filter((b: any) => {
            const isLeaveInSession = sessions.some(s => s.sessionIndex === b.sessionIndex && b.type === 'LEAVE');
            return !isLeaveInSession;
        });

        const isoDate = getClinicISODateString(dateObj);
        const allAppointments = await this.appointmentRepo.findByClinicAndDate(clinicId, isoDate);

        // ATOMIC TRANSACTION
        await this.appointmentRepo.runTransaction(async (txn: ITransaction) => {
            if (action === 'MARK_LEAVE') {
                for (const session of sessions) {
                    const sessionStart = parseClinicTime(session.from, dateObj);
                    const sessionEnd = parseClinicTime(session.to, dateObj);
                    
                    newBreaks.push({
                        id: `leave-${Date.now()}-${session.sessionIndex}`,
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

                    const sessionAppointments = allAppointments.filter(a => 
                        a.doctorId === doctorId && a.sessionIndex === session.sessionIndex && (a.status === 'Pending' || a.status === 'Confirmed')
                    );

                    for (const appt of sessionAppointments) {
                        await this.appointmentRepo.update(appt.id, appt.clinicId, { status: 'Cancelled', cancellationReason: 'DOCTOR_LEAVE' }, txn);
                        affectedCount++;
                    }
                }
            } else {
                const cancelledByLeave = allAppointments.filter(a => 
                    a.doctorId === doctorId && a.status === 'Cancelled' && a.cancellationReason === 'DOCTOR_LEAVE' && sessions.some(s => s.sessionIndex === a.sessionIndex)
                );

                for (const appt of cancelledByLeave) {
                    await this.appointmentRepo.update(appt.id, appt.clinicId, { status: 'Pending', cancellationReason: undefined }, txn);
                    affectedCount++;
                }
            }

            breakPeriods[date] = newBreaks;

            // Update Doctor
            await this.doctorRepo.update(doctorId, clinicId, { breakPeriods }, txn);
            await this.doctorRepo.saveBreaks(doctorId, clinicId, date, newBreaks, txn);
        });

        this.doctorRepo.invalidateCache(doctorId, clinicId);

        await this.activityRepo.save({
            id: '', type: 'SCHEDULING_CHANGE', action: action === 'MARK_LEAVE' ? 'UPDATE_LEAVE' : 'CANCEL_LEAVE',
            doctorId, clinicId, performedBy,
            details: { date, affectedCount, sessions: sessions.map(s => s.sessionIndex) },
            timestamp: new Date(), expiresAt: null
        });
    }
}
