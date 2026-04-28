import { IAppointmentRepository, IDoctorRepository, IClinicRepository, IActivityRepository } from '../domain/repositories';
import { 
    parseClinicDate,
    getClinicDayOfWeek,
    parseClinicTime,
    addMinutes,
    getClinicTimeString
} from '../domain/services/DateUtils';
import { BreakPeriod, KloqoRole, KLOQO_ROLES } from '../../../packages/shared/src/index';
import { format, subMinutes } from 'date-fns';
import { db } from '../infrastructure/firebase/config';

export interface EditBreakRequest {
    clinicId: string;
    doctorId: string;
    breakId: string;
    date: string;
    startTime: string;
    endTime: string;
    performedBy: { id: string; name: string; role: KloqoRole };
}

export class EditBreakUseCase {
    constructor(
        private appointmentRepo: IAppointmentRepository,
        private doctorRepo: IDoctorRepository,
        private clinicRepo: IClinicRepository,
        private activityRepo: IActivityRepository
    ) {}

    async execute(request: EditBreakRequest): Promise<void> {
        const { clinicId, doctorId, breakId, date, startTime, endTime, performedBy } = request;

        const doctor = await this.doctorRepo.findById(doctorId);
        if (!doctor) throw new Error('Doctor not found');

        // RBAC Softening (Self-Management Check)
        const isSelfInitiated = performedBy.id === doctor.id || performedBy.id === doctor.userId;
        const isAdmin = ([KLOQO_ROLES.CLINIC_ADMIN, KLOQO_ROLES.SUPER_ADMIN] as KloqoRole[]).includes(performedBy.role);
        if (!isAdmin && !isSelfInitiated) {
            throw new Error('Unauthorized: You can only manage your own schedule.');
        }

        const breakPeriods = doctor.breakPeriods || {};
        const dateBreaks = breakPeriods[date] || [];
        const oldBreak = dateBreaks.find((b: any) => b.id === breakId);
        if (!oldBreak) throw new Error('Break not found');

        const baseDate = parseClinicDate(date);
        const newBreakStart = parseClinicTime(startTime, baseDate);
        const newBreakEnd = parseClinicTime(endTime, baseDate);
        const oldBreakStart = new Date(oldBreak.startTime);
        const oldDuration = oldBreak.duration;
        const newDuration = (newBreakEnd.getTime() - newBreakStart.getTime()) / (1000 * 60);

        if (newBreakEnd <= newBreakStart) throw new Error('End time must be after start time');

        // 1. Identify all appointments in the session
        const allAppointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, date);
        const sessionAppointments = allAppointments.filter(a => a.sessionIndex === oldBreak.sessionIndex && a.status !== 'Cancelled');

        // 2. Perform Differential Shift
        // Step A: "Undo" the previous drift for all appointments after the OLD break start
        // Step B: "Apply" the new drift for all appointments after the NEW break start
        for (const appt of sessionAppointments) {
            let apptTime = parseClinicTime(appt.arriveByTime || appt.time, baseDate);
            
            // Revert old drift
            if (apptTime >= oldBreakStart) {
                apptTime = addMinutes(apptTime, -oldDuration);
            }

            // Apply new drift
            if (apptTime >= newBreakStart) {
                apptTime = addMinutes(apptTime, newDuration);
            }

            await this.appointmentRepo.update(appt.id, {
                time: getClinicTimeString(apptTime),
                arriveByTime: getClinicTimeString(subMinutes(apptTime, 15)),
                cancelledByBreak: apptTime >= newBreakStart && apptTime < newBreakEnd,
                updatedAt: new Date()
            });
        }

        // 3. Update Doctor Record
        const updatedBreak: BreakPeriod = {
            ...oldBreak,
            startTime: newBreakStart.toISOString(),
            endTime: newBreakEnd.toISOString(),
            startTimeFormatted: startTime,
            endTimeFormatted: endTime,
            duration: newDuration,
        };

        const updatedBreaks = dateBreaks.map(b => b.id === breakId ? updatedBreak : b);
        breakPeriods[date] = updatedBreaks;

        // 4. Update Session Extension
        const availabilityExtensions = doctor.availabilityExtensions || {};
        const dateExtensions = availabilityExtensions[date] || { sessions: [] };
        const sessionExtIndex = dateExtensions.sessions.findIndex((s: any) => s.sessionIndex === oldBreak.sessionIndex);
        
        if (sessionExtIndex >= 0) {
            const ext = dateExtensions.sessions[sessionExtIndex];
            const driftDelta = newDuration - oldDuration;
            ext.totalExtendedBy += driftDelta;
            const currentEndTime = parseClinicTime(ext.newEndTime, baseDate);
            ext.newEndTime = getClinicTimeString(addMinutes(currentEndTime, driftDelta));
        }

        await this.doctorRepo.update(doctorId, {
            breakPeriods,
            availabilityExtensions,
            updatedAt: new Date()
        });

        // Dual-write: write to breaks subcollection
        const safeDateId = date.replace(/\//g, '-');
        const breaksSubRef = db.collection('doctors').doc(doctorId).collection('breaks').doc(safeDateId);
        await breaksSubRef.set({ breaks: breakPeriods[date], date }, { merge: true });

        // 5. Audit Log
        await this.activityRepo.save({
            id: '',
            type: 'SCHEDULING_CHANGE',
            action: 'EDIT_BREAK',
            doctorId,
            clinicId,
            performedBy,
            details: {
                date,
                breakId,
                oldDuration,
                newDuration,
                startTime,
                endTime
            },
            timestamp: new Date(),
            expiresAt: null
        });
    }
}
