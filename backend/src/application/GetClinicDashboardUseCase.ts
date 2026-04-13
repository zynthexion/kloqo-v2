import { IClinicRepository, IAppointmentRepository, IDoctorRepository, IPatientRepository, IPrescriptionRepository } from '../domain/repositories';
import { ClinicNotApprovedError, OnboardingIncompleteError } from '../domain/errors';
import { differenceInDays, parse, isWithinInterval, startOfDay, subDays, isToday, isFuture, eachDayOfInterval, format, eachMonthOfInterval, endOfMonth } from 'date-fns';
import { Appointment, Doctor } from '../../../packages/shared/src/index';

export class GetClinicDashboardUseCase {
  constructor(
    private clinicRepo: IClinicRepository,
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private patientRepo: IPatientRepository,
    private prescriptionRepo: IPrescriptionRepository
  ) {}

  async execute(clinicId: string, params?: { startDate?: string; endDate?: string; doctorId?: string }) {
    try {
      const clinic = await this.clinicRepo.findById(clinicId);
      if (!clinic) throw new Error('Clinic not found');

      if (clinic.registrationStatus !== 'Approved') {
        throw new ClinicNotApprovedError();
      }
      
      if (clinic.onboardingStatus !== 'Completed') {
        throw new OnboardingIncompleteError();
      }

      const startDate = params?.startDate ? new Date(params.startDate) : subDays(new Date(), 6);
      const endDate = params?.endDate ? new Date(params.endDate) : new Date();
      const doctorId = params?.doctorId;

      const diff = differenceInDays(endDate, startDate);
      const prevStart = subDays(startDate, diff + 1);
      const prevEnd = subDays(endDate, diff + 1);

      // ✅ FIX: Only fetch appointments scoped to THIS clinic (already correct).
      // ✅ FIX: Replace the cross-tenant `findAll()` on patients with a clinic-scoped call.
      //    The old code was calling this.patientRepo.findAll() which fetched EVERY patient
      //    in the entire Firestore database on every dashboard load.
      const [appointmentsResult, doctorsResult, patientsResult, prescriptionsResult] = await Promise.all([
        this.appointmentRepo.findByClinicId(clinicId, prevStart, endDate),
        this.doctorRepo.findByClinicId(clinicId),
        this.patientRepo.findByClinicId(clinicId),
        this.prescriptionRepo.findByClinicAndDateRange(clinicId, startDate, endDate),
      ]);

      const allDoctors = doctorsResult as Doctor[];
      const prescriptions = prescriptionsResult as any[];

      // ─────────────────────────────────────────────────────────────────
      // ANALYTICS GUARDRAIL: Strip ALL system-generated ghost blocker
      // records BEFORE any metric is computed. Ghost records are inserted
      // by ScheduleBreakUseCase to hard-block break slots in the DB and
      // must NEVER appear in patient counts, revenue, or appointment stats.
      // ─────────────────────────────────────────────────────────────────
      const allAppointments = (appointmentsResult as Appointment[]).filter(a => !a.isSystemBlocker);

      // --- ROI ANALYTICS MIGRATION (Omnichannel Triage) ---

      // 1. Identify dispensed vs abandoned via the Appointment model (New Schema)
      const dispensedAppointments = allAppointments.filter(a => a.pharmacyStatus === 'dispensed');
      const abandonedAppointments = allAppointments.filter(a => a.pharmacyStatus === 'abandoned');
      const pendingAppointments = allAppointments.filter(a => a.pharmacyStatus === 'pending' && a.prescriptionUrl);

      // 2. Identify WhatsApp vs Printed leakage
      const whatsappDigitalAbandonments = abandonedAppointments.filter(a => a.abandonedReason === 'Requested Digital via WhatsApp');
      const printedAbandonments = abandonedAppointments.filter(a => a.abandonedReason && a.abandonedReason !== 'Requested Digital via WhatsApp');

      // 3. Revenue Metrics
      const revenueCaptured = dispensedAppointments.reduce((sum, a) => sum + (a.dispensedValue || 0), 0);
      const walkOutsCount = abandonedAppointments.length;
      
      const totalWrittenCount = dispensedAppointments.length + abandonedAppointments.length + pendingAppointments.length;
      const fulfillmentRate = totalWrittenCount > 0 ? Math.round((dispensedAppointments.length / totalWrittenCount) * 100) : 0;

      // 4. Omnichannel Breakdown
      // Note: We count ALL dispensed as potential "Value", but leakage is now segmented
      const totalRxValue = revenueCaptured + printedAbandonments.length * 500; // Legacy logic: using 500 as an avg for leakage value if missing

      // Calculation of whatsapp vs printed fulfillment rates
      // printed abandonment includes patient buying elsewhere or requested printout
      const whatsappFulfilledCount = dispensedAppointments.length; // Currently we treat all dispensed as fulfillment center success
      const whatsappFulfillmentRate = (whatsappFulfilledCount + whatsappDigitalAbandonments.length) > 0 
        ? Math.round((whatsappFulfilledCount / (whatsappFulfilledCount + whatsappDigitalAbandonments.length)) * 100) 
        : 0;
      
      const printedFulfillmentRate = printedAbandonments.length > 0 ? 0 : 100; // Printed is treated as 100% leakage if present

      // 5. Live Prescription Queue (Today's Pending)
      const livePrescriptions = pendingAppointments.filter(a => 
        isToday(a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt))
      );

      let filteredAppointments = allAppointments;
      if (doctorId) {
        filteredAppointments = allAppointments.filter((apt: Appointment) => apt.doctorId === doctorId);
      }

      const getStatsForPeriod = (from: Date, to: Date) => {
        const periodAppointments = filteredAppointments.filter(apt => {
          // ANALYTICS GUARDRAIL: double-check — never include ghost blocker records.
          // filteredAppointments is already stripped above, but belt-and-suspenders.
          if (apt.isSystemBlocker) return false;
          try {
            const aptDate = parse(apt.date, 'd MMMM yyyy', new Date());
            return isWithinInterval(aptDate, { start: startOfDay(from), end: startOfDay(to) });
          } catch { return false; }
        });

        const uniquePatients = new Set(periodAppointments.map(apt => apt.patientId));
        const completedAppointmentsList = periodAppointments.filter(apt => apt.status === 'Completed');
        const cancelledAppointmentsCount = periodAppointments.filter(apt => apt.status === 'Cancelled' && !apt.cancelledByBreak).length;
        const upcomingAppointmentsList = periodAppointments.filter(apt => {
          try {
            const aptDate = parse(apt.date, 'd MMMM yyyy', new Date());
            return (apt.status === 'Confirmed' || apt.status === 'Pending') && (isFuture(aptDate) || isToday(aptDate));
          } catch { return false; }
        });
        const noShowAppointmentsCount = periodAppointments.filter(apt => apt.status === 'No-show' || apt.status === 'Skipped').length;

        let totalRevenue = 0;
        const completedByPatientAndDoctor: Record<string, any[]> = {};

        completedAppointmentsList.forEach(apt => {
          const key = `${apt.patientId}-${apt.doctorId}`;
          if (!completedByPatientAndDoctor[key]) {
            completedByPatientAndDoctor[key] = [];
          }
          completedByPatientAndDoctor[key].push(apt);
        });

        for (const key in completedByPatientAndDoctor) {
          const appointments = completedByPatientAndDoctor[key].sort((a, b) =>
            parse(a.date, 'd MMMM yyyy', new Date()).getTime() - parse(b.date, 'd MMMM yyyy', new Date()).getTime()
          );
          const doctor = allDoctors.find(d => d.id === appointments[0].doctorId);
          const freeFollowUpDays = doctor?.freeFollowUpDays ?? 0;
          const consultationFee = doctor?.consultationFee ?? 0;

          for (let i = 0; i < appointments.length; i++) {
            const currentApt = appointments[i];
            const previousApt = i > 0 ? appointments[i - 1] : null;

            let isFree = false;
            if (previousApt && freeFollowUpDays > 0) {
              const daysBetween = differenceInDays(
                parse(currentApt.date, 'd MMMM yyyy', new Date()),
                parse(previousApt.date, 'd MMMM yyyy', new Date())
              );
              if (daysBetween <= freeFollowUpDays) {
                isFree = true;
              }
            }
            if (!isFree) {
              totalRevenue += consultationFee;
            }
          }
        }

        return {
          totalPatients: uniquePatients.size,
          completedAppointments: completedAppointmentsList.length,
          cancelledAppointments: cancelledAppointmentsCount,
          upcomingAppointments: upcomingAppointmentsList.length,
          noShowAppointments: noShowAppointmentsCount,
          totalRevenue,
          appointments: periodAppointments
        };
      };

      const current = getStatsForPeriod(startDate, endDate);
      const previous = getStatsForPeriod(prevStart, prevEnd);

      const calculateChange = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? "+100%" : "0%";
        const change = ((curr - prev) / prev) * 100;
        return (change > 0 ? "+" : "") + change.toFixed(0) + "%";
      };

      // Time series data for charts
      const dayCount = differenceInDays(endDate, startDate);
      const isMonthlyView = dayCount > 60;
      let timeSeries: any[] = [];

      if (isMonthlyView) {
        const months = eachMonthOfInterval({ start: startDate, end: endDate });
        timeSeries = months.map(monthStart => {
          const monthEnd = endOfMonth(monthStart);
          const stats = getStatsForPeriod(monthStart, monthEnd);
          return {
            label: format(monthStart, 'MMM yyyy'),
            newPatients: stats.totalPatients,
            revenue: stats.totalRevenue,
            appointments: stats.completedAppointments
          };
        });
      } else {
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        timeSeries = days.map(day => {
          const stats = getStatsForPeriod(day, day);
          return {
            label: format(day, 'MMM d'),
            newPatients: stats.totalPatients,
            revenue: stats.totalRevenue,
            appointments: stats.completedAppointments
          };
        });
      }

      // Hourly distribution
      const hourlyDistribution: Record<number, number> = {};
      for (let i = 0; i < 24; i++) hourlyDistribution[i] = 0;

      current.appointments.forEach(apt => {
        try {
          const hour = parseInt(apt.time.split(':')[0]);
          if (!isNaN(hour)) hourlyDistribution[hour]++;
        } catch {}
      });

      return {
        roi: {
          revenueCaptured,
          totalRxValue,
          walkOutsCount,
          fulfillmentRate,
          whatsappFulfillmentRate,
          printedFulfillmentRate,
          livePrescriptionQueue: livePrescriptions.map(apt => ({
            id: apt.id,
            patientName: apt.patientName,
            doctorName: apt.doctorName,
            status: apt.pharmacyStatus,
            createdAt: apt.createdAt
          }))
        },
        current: {
          totalPatients: current.totalPatients,
          completedAppointments: current.completedAppointments,
          cancelledAppointments: current.cancelledAppointments,
          upcomingAppointments: current.upcomingAppointments,
          noShowAppointments: current.noShowAppointments,
          totalRevenue: current.totalRevenue,
          totalDoctors: allDoctors.length
        },
        comparison: {
          patientsChange: calculateChange(current.totalPatients, previous.totalPatients),
          appointmentsChange: calculateChange(current.completedAppointments, previous.completedAppointments),
          revenueChange: calculateChange(current.totalRevenue, previous.totalRevenue),
          cancelledChange: calculateChange(current.cancelledAppointments, previous.cancelledAppointments),
        },
        timeSeries,
        hourlyStats: Object.entries(hourlyDistribution).map(([hour, count]) => ({
          hour: parseInt(hour),
          count
        })),
        recentAppointments: current.appointments.slice(0, 10).map(apt => ({
          id: apt.id,
          patientName: apt.patientName,
          time: apt.time,
          doctorName: allDoctors.find(d => d.id === apt.doctorId)?.name || 'Unknown',
          status: apt.status
        })),
        doctorAvailability: allDoctors.map(doc => {
          const docAppointments = current.appointments.filter(a => a.doctorId === doc.id);
          const isBusy = docAppointments.some(a => a.status === 'Confirmed');
          return {
            id: doc.id,
            name: doc.name,
            avatar: doc.avatar,
            specialization: doc.department || 'General',
            status: isBusy ? 'Busy' : 'Available',
            nextAvailableSlot: '10:00 AM'
          };
        })
      };

    } catch (error: any) {
      console.error('Error in GetClinicDashboardUseCase:', error);
      throw error;
    }
  }
}
