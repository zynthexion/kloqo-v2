import { 
    IDoctorRepository, 
    IClinicRepository, 
    IAppointmentRepository 
} from '../domain/repositories';
import { 
    getClinicNow, 
    getClinicDateString,
    parseClinicTime,
    getClinicDayNumeric,
    isAfter,
    isBefore,
    subMinutes,
    getClinicISODateString,
    getClinicDayOfWeek
} from '../domain/services/DateUtils';

export class SyncClinicStatusesUseCase {
    constructor(
        private doctorRepo: IDoctorRepository,
        private clinicRepo: IClinicRepository,
        private appointmentRepo: IAppointmentRepository
    ) {}

    async execute(clinicId: string): Promise<void> {
        const clinic = await this.clinicRepo.findById(clinicId);
        if (!clinic) throw new Error('Clinic not found');

        const doctorsResult = await this.doctorRepo.findByClinicId(clinicId);
        const doctors = Array.isArray(doctorsResult) ? doctorsResult : doctorsResult.data;

        const now = getClinicNow();
        const dateStr = getClinicDateString(now);
        const isoDate = getClinicISODateString(now);

        for (const doctor of doctors) {
            let newStatus = 'Out';
            
            // 1. Check for manual overrides or leaves first
            const breakPeriodsLegacy = doctor.breakPeriods?.[dateStr] || [];
            const breakPeriodsIso = doctor.breakPeriods?.[isoDate] || [];
            const breakPeriods = [...breakPeriodsLegacy, ...breakPeriodsIso];

            const activeBreak = breakPeriods.find((b: any) => {
                const start = new Date(b.startTime);
                const end = new Date(b.endTime);
                return now >= start && now < end;
            });

            if (activeBreak) {
                newStatus = 'On Break';
            } else {
                // 2. Check availability slots
                const dayOfWeekLabel = getClinicDayOfWeek(now);
                const todaysAvailability = doctor.availabilitySlots?.find(s => s.day === dayOfWeekLabel);
                
                if (todaysAvailability) {
                    const isAnySessionActive = todaysAvailability.timeSlots.some((session: any, index: number) => {
                        let startTime = parseClinicTime(session.from, now);
                        let endTime = parseClinicTime(session.to, now);

                        // Consider extensions: check both legacy and ISO
                        const extLegacy = doctor.availabilityExtensions?.[dateStr]?.sessions?.find((s: any) => s.sessionIndex === index);
                        const extIso = doctor.availabilityExtensions?.[isoDate]?.sessions?.find((s: any) => s.sessionIndex === index);
                        const extension = extIso || extLegacy;

                        if (extension?.newEndTime) {
                            endTime = parseClinicTime(extension.newEndTime, now);
                        }

                        // Buffer: Doctor is "In" 30 mins before session starts
                        return now >= subMinutes(startTime, 30) && now < endTime;
                    });

                    if (isAnySessionActive) {
                        newStatus = 'In';
                    }
                }
            }
            // 3. Lazy Cleanup: Prune past overrides to save space
            const expiredKeys = Object.keys(doctor.dateOverrides || {})
                .filter(key => key < isoDate);
            
            if (expiredKeys.length > 0) {
                await this.doctorRepo.prunePastOverrides(doctor.id, expiredKeys);
            }

            // 4. Do not force 'Out' if the doctor is currently 'In' manually.
            // Let the doctor manually toggle 'Out', or let the EndSessionCleanupUseCase handle it overnight.
            if (newStatus === 'Out' && doctor.consultationStatus === 'In') {
                newStatus = 'In';
            }

            if (doctor.consultationStatus !== newStatus) {
                await this.doctorRepo.update(doctor.id, {
                    consultationStatus: newStatus,
                    updatedAt: new Date()
                });
            }
        }
    }

    async syncDoctor(doctorId: string): Promise<string> {
        const doctor = await this.doctorRepo.findById(doctorId);
        if (!doctor) throw new Error('Doctor not found');

        const now = getClinicNow();
        const dateStr = getClinicDateString(now);
        const isoDate = getClinicISODateString(now);

        let newStatus = 'Out';
        
        const breakPeriodsLegacy = doctor.breakPeriods?.[dateStr] || [];
        const breakPeriodsIso = doctor.breakPeriods?.[isoDate] || [];
        const breakPeriods = [...breakPeriodsLegacy, ...breakPeriodsIso];

        const activeBreak = breakPeriods.find((b: any) => {
            const start = new Date(b.startTime);
            const end = new Date(b.endTime);
            return now >= start && now < end;
        });

        if (activeBreak) {
            newStatus = 'On Break';
        } else {
            const dayOfWeekLabel = getClinicDayOfWeek(now);
            const todaysAvailability = doctor.availabilitySlots?.find(s => s.day === dayOfWeekLabel);
            
            if (todaysAvailability) {
                const isAnySessionActive = todaysAvailability.timeSlots.some((session: any, index: number) => {
                    let startTime = parseClinicTime(session.from, now);
                    let endTime = parseClinicTime(session.to, now);

                    const extLegacy = doctor.availabilityExtensions?.[dateStr]?.sessions?.find((s: any) => s.sessionIndex === index);
                    const extIso = doctor.availabilityExtensions?.[isoDate]?.sessions?.find((s: any) => s.sessionIndex === index);
                    const extension = extIso || extLegacy;

                    if (extension?.newEndTime) {
                        endTime = parseClinicTime(extension.newEndTime, now);
                    }

                    return now >= subMinutes(startTime, 30) && now < endTime;
                });

                if (isAnySessionActive) {
                    newStatus = 'In';
                }
            }
        }
        // 3. Lazy Cleanup
        const expiredKeys = Object.keys(doctor.dateOverrides || {})
            .filter(key => key < isoDate);
        
        if (expiredKeys.length > 0) {
            await this.doctorRepo.prunePastOverrides(doctor.id, expiredKeys);
        }

        // 4. Do not force 'Out' if the doctor is currently 'In' manually.
        if (newStatus === 'Out' && doctor.consultationStatus === 'In') {
            newStatus = 'In';
        }

        if (doctor.consultationStatus !== newStatus) {
            await this.doctorRepo.update(doctor.id, {
                consultationStatus: newStatus,
                updatedAt: new Date()
            });
        }

        return newStatus;
    }
}
