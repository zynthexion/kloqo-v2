import { Clinic, Patient, Appointment, GrowthDataPoint } from '../../../../packages/shared/src/index';

export class SuperadminMetricsService {
  /**
   * Calculate 30-day retention rate
   */
  static calculateRetention(
    patients: Patient[],
    appointments: Appointment[],
    days: number = 30
  ): number {
    const patientAppointments = new Map<string, Date[]>();
    
    appointments.forEach((apt) => {
      const createdAt = (apt.createdAt as any) instanceof Date ? (apt.createdAt as any) : ((apt.createdAt as any)?.toDate ? (apt.createdAt as any).toDate() : new Date(apt.createdAt as any));
      if (!patientAppointments.has(apt.patientId)) {
        patientAppointments.set(apt.patientId, []);
      }
      patientAppointments.get(apt.patientId)!.push(createdAt);
    });

    let retainedPatients = 0;
    let totalPatientsWithMultipleBookings = 0;

    patientAppointments.forEach((aptDates) => {
      if (aptDates.length < 2) return;
      
      totalPatientsWithMultipleBookings++;
      const sortedDates = aptDates.sort((a, b) => a.getTime() - b.getTime());
      const firstBooking = sortedDates[0];
      const secondBooking = sortedDates[1];
      
      const daysDiff = Math.floor((secondBooking.getTime() - firstBooking.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= days) retainedPatients++;
    });

    return totalPatientsWithMultipleBookings === 0 ? 0 : (retainedPatients / totalPatientsWithMultipleBookings) * 100;
  }

  /**
   * Calculate Monthly Active Users
   */
  static calculateMAU(appointments: Appointment[], targetMonth: Date): number {
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);
    
    const uniquePatients = new Set<string>();
    appointments.forEach((apt) => {
      const aptDate = (apt.createdAt as any) instanceof Date ? (apt.createdAt as any) : ((apt.createdAt as any)?.toDate ? (apt.createdAt as any).toDate() : new Date(apt.createdAt as any));
      if (aptDate >= monthStart && aptDate <= monthEnd) {
        uniquePatients.add(apt.patientId);
      }
    });
    
    return uniquePatients.size;
  }

  /**
   * Generate historical growth data for charts
   */
  static generateGrowthData(
    clinics: Clinic[],
    patients: Patient[],
    appointments: Appointment[],
    months: number = 6
  ): GrowthDataPoint[] {
    const now = new Date();
    const data: GrowthDataPoint[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

      // Cumulative counts for clinics and patients
      const clinicsCount = clinics.filter(c => {
        const date = (c.registrationDate as any) instanceof Date ? (c.registrationDate as any) : ((c.registrationDate as any)?.toDate ? (c.registrationDate as any).toDate() : (c.registrationDate ? new Date(c.registrationDate as any) : null));
        return date && !isNaN(date.getTime()) && date <= monthEnd;
      }).length;

      const patientsCount = patients.filter(p => {
        const date = (p.createdAt as any) instanceof Date ? (p.createdAt as any) : ((p.createdAt as any)?.toDate ? (p.createdAt as any).toDate() : (p.createdAt ? new Date(p.createdAt as any) : null));
        return date && !isNaN(date.getTime()) && date <= monthEnd;
      }).length;
      
      // Monthly count for appointments
      const appointmentsCount = appointments.filter(a => {
        const date = (a.createdAt as any) instanceof Date ? (a.createdAt as any) : ((a.createdAt as any)?.toDate ? (a.createdAt as any).toDate() : (a.createdAt ? new Date(a.createdAt as any) : null));
        return date && date >= monthStart && date <= monthEnd;
      }).length;

      data.push({
        date: yearMonth,
        clinics: clinicsCount,
        patients: patientsCount,
        appointments: appointmentsCount
      });
    }

    return data;
  }

  static calculateClinicHealth(
    clinic: Clinic,
    appointments: Appointment[],
    now: Date = new Date()
  ): number {
    let score = 0;
    
    if (clinic.onboardingStatus === 'Completed') score += 20;
    else if (clinic.onboardingStatus === 'Pending') score += 10;
    
    const currentDoctors = clinic.numDoctors || 0;
    score += Math.min(20, (currentDoctors / 5) * 20);
    
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentAppointments = appointments.filter(apt => {
      const aptDate = (apt.createdAt as any) instanceof Date ? (apt.createdAt as any) : ((apt.createdAt as any)?.toDate ? (apt.createdAt as any).toDate() : new Date(apt.createdAt as any));
      return aptDate >= thirtyDaysAgo;
    }).length;
    
    score += Math.min(60, (recentAppointments / 100) * 60);
    
    return Math.round(score);
  }

  static calculateRegistrationTrends(patients: Patient[], days: number = 30): Array<{ date: string; count: number }> {
    const now = new Date();
    const trends: Map<string, number> = new Map();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trends.set(dateStr, 0);
    }

    patients.forEach(p => {
      const date = (p.createdAt as any) instanceof Date ? (p.createdAt as any) : ((p.createdAt as any)?.toDate ? (p.createdAt as any).toDate() : (p.createdAt ? new Date(p.createdAt as any) : null));
      if (!date || isNaN(date.getTime())) return;
      
      const dateStr = date.toISOString().split('T')[0];
      if (trends.has(dateStr)) {
        trends.set(dateStr, (trends.get(dateStr) || 0) + 1);
      }
    });

    return Array.from(trends.entries()).map(([date, count]) => ({ date, count }));
  }

  static calculateSegmentation(appointments: Appointment[]): { new: number; returning: number } {
    const patientCounts = new Map<string, number>();
    appointments.forEach(a => {
      patientCounts.set(a.patientId, (patientCounts.get(a.patientId) || 0) + 1);
    });

    let newCount = 0;
    let returningCount = 0;

    patientCounts.forEach(count => {
      if (count === 1) newCount++;
      else returningCount++;
    });

    return { new: newCount, returning: returningCount };
  }

  static calculateDemographics(patients: Patient[]): { ageGroups: any[]; gender: any[] } {
    const ageGroups: Record<string, number> = { '0-18': 0, '19-30': 0, '31-45': 0, '46-60': 0, '61-75': 0, '75+': 0 };
    const gender: Record<string, number> = { 'Male': 0, 'Female': 0, 'Other': 0, 'Not Specified': 0 };

    patients.forEach(p => {
      const age = p.age || 0;
      if (age <= 18) ageGroups['0-18']++;
      else if (age <= 30) ageGroups['19-30']++;
      else if (age <= 45) ageGroups['31-45']++;
      else if (age <= 60) ageGroups['46-60']++;
      else if (age <= 75) ageGroups['61-75']++;
      else ageGroups['75+']++;

      const sex = p.sex || '';
      if (sex === 'Male') gender['Male']++;
      else if (sex === 'Female') gender['Female']++;
      else if (sex === 'Other') gender['Other']++;
      else gender['Not Specified']++;
    });

    return {
      ageGroups: Object.entries(ageGroups).map(([name, value]) => ({ name, value })),
      gender: Object.entries(gender).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }))
    };
  }

  static calculatePunctualityStats(appointments: Appointment[], startDate?: Date, endDate?: Date) {
    let filteredApts = appointments;
    if (startDate || endDate) {
      filteredApts = appointments.filter(apt => {
        const date = (apt.createdAt as any) instanceof Date ? (apt.createdAt as any) : ((apt.createdAt as any)?.toDate ? (apt.createdAt as any).toDate() : new Date(apt.createdAt as any));
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      });
    }

    const confirmedApts = filteredApts.filter(apt => apt.status === 'Confirmed' || apt.status === 'Completed');
    const completedApts = filteredApts.filter(apt => apt.status === 'Completed');

    if (confirmedApts.length === 0) return { 
      punctuality: 0, 
      avgWait: 0, 
      meetingEfficiency: 0, 
      total: 0,
      punctualCount: 0,
      confirmedCount: 0,
      efficientCount: 0,
      completedCount: 0,
      waitCount: 0
    };

    let punctualCount = 0;
    confirmedApts.forEach(apt => {
      if (apt.confirmedAt && apt.arriveByTime && typeof apt.arriveByTime === 'string') {
        const confirmed = (apt.confirmedAt as any)?.toDate ? (apt.confirmedAt as any).toDate() : new Date(apt.confirmedAt);
        try {
          const parts = apt.arriveByTime.split(' ');
          if (parts.length < 2) return;
          const [time, period] = parts;
          
          let [hoursStr, minutesStr] = time.split(':');
          let hours = parseInt(hoursStr);
          let minutes = parseInt(minutesStr);
          
          if (isNaN(hours) || isNaN(minutes)) return;
          
          if (period === 'PM' && hours < 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;

          const target = new Date(confirmed);
          target.setHours(hours, minutes, 0, 0);
          if (confirmed <= target) punctualCount++;
        } catch (e) {}
      }
    });

    let totalWaitMs = 0;
    let waitCount = 0;
    completedApts.forEach(apt => {
      if (apt.confirmedAt && apt.completedAt) {
        const confirmed = (apt.confirmedAt as any)?.toDate ? (apt.confirmedAt as any).toDate() : new Date(apt.confirmedAt);
        const completed = (apt.completedAt as any)?.toDate ? (apt.completedAt as any).toDate() : new Date(apt.completedAt);
        const wait = completed.getTime() - confirmed.getTime();
        if (wait > 0) {
          totalWaitMs += wait;
          waitCount++;
        }
      }
    });

    let efficientCount = 0;
    completedApts.forEach(apt => {
      if (apt.completedAt && apt.time && typeof apt.time === 'string') {
        const completed = (apt.completedAt as any)?.toDate ? (apt.completedAt as any).toDate() : new Date(apt.completedAt);
        try {
          const parts = apt.time.split(' ');
          if (parts.length < 2) return;
          const [time, period] = parts;
          
          let [hoursStr, minutesStr] = time.split(':');
          let hours = parseInt(hoursStr);
          let minutes = parseInt(minutesStr);
          
          if (isNaN(hours) || isNaN(minutes)) return;
          
          if (period === 'PM' && hours < 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;

          const scheduled = new Date(completed);
          scheduled.setHours(hours, minutes, 0, 0);
          if (completed <= new Date(scheduled.getTime() + 15 * 60000)) efficientCount++;
        } catch (e) {}
      }
    });

    return {
      punctuality: confirmedApts.length > 0 ? (punctualCount / confirmedApts.length) * 100 : 0,
      avgWait: waitCount > 0 ? Math.round(totalWaitMs / waitCount / 60000) : 0,
      meetingEfficiency: completedApts.length > 0 ? (efficientCount / completedApts.length) * 100 : 0,
      total: confirmedApts.length,
      punctualCount,
      confirmedCount: confirmedApts.length,
      efficientCount,
      completedCount: completedApts.length,
      waitCount
    };
  }
}
