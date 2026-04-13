/**
 * Helper to parse date strings like "15 October 2024"
 */
export function parseDateString(dateStr: string): Date {
  try {
    const months: Record<string, number> = {
      'january': 0, 'february': 1, 'march': 2, 'april': 3,
      'may': 4, 'june': 5, 'july': 6, 'august': 7,
      'september': 8, 'october': 9, 'november': 10, 'december': 11
    };
    
    const parts = dateStr.toLowerCase().split(' ');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = months[parts[1]];
      const year = parseInt(parts[2]);
      
      if (!isNaN(day) && month !== undefined && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
  } catch (e) {}
  return new Date(dateStr);
}

/**
 * Calculate growth percentage between two values
 */
export function calculateGrowthPercentage(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Format growth percentage with sign
 */
export function formatGrowthPercentage(current: number, previous: number): string {
  const growth = calculateGrowthPercentage(current, previous);
  if (growth === 0) return '0%';
  const sign = growth > 0 ? '+' : '';
  return `${sign}${growth.toFixed(1)}%`;
}

/**
 * Calculate retention rate for specified days
 */
export function calculate30DayRetention(
  appointments: Array<{ patientId: string; createdAt?: any }>,
  days: number = 30
): number {
  const patientAppointments = new Map<string, Date[]>();
  
  appointments.forEach((apt) => {
    if (!patientAppointments.has(apt.patientId)) {
      patientAppointments.set(apt.patientId, []);
    }
    
    const aptDate = apt.createdAt instanceof Date ? apt.createdAt : new Date(apt.createdAt);
    patientAppointments.get(apt.patientId)!.push(aptDate);
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
    
    if (daysDiff <= days) {
      retainedPatients++;
    }
  });

  if (totalPatientsWithMultipleBookings === 0) return 0;
  return (retainedPatients / totalPatientsWithMultipleBookings) * 100;
}

/**
 * Calculate Monthly Active Users (MAU)
 */
export function calculateMAU(
  appointments: Array<{ patientId: string; createdAt?: any }>,
  targetMonth: Date
): number {
  const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
  const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
  
  const uniquePatients = new Set<string>();
  
  appointments.forEach((apt) => {
    const aptDate = apt.createdAt instanceof Date ? apt.createdAt : new Date(apt.createdAt);
    if (aptDate >= monthStart && aptDate <= monthEnd) {
      uniquePatients.add(apt.patientId);
    }
  });
  
  return uniquePatients.size;
}

/**
 * Calculate clinic health score (0-100)
 */
export function calculateClinicHealth(
  clinic: {
    onboardingStatus?: string;
    numDoctors?: number;
  },
  appointments: Array<{ createdAt?: any }>,
  now: Date = new Date()
): number {
  let score = 0;
  
  if (clinic.onboardingStatus === 'Completed') {
    score += 20;
  } else if (clinic.onboardingStatus === 'Pending') {
    score += 10;
  }
  
  const currentDoctors = clinic.numDoctors || 0;
  score += Math.min(20, (currentDoctors / 5) * 20); // Normalized to 5 docs
  
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentAppointments = appointments.filter((apt) => {
    const aptDate = apt.createdAt instanceof Date ? apt.createdAt : new Date(apt.createdAt);
    return aptDate >= thirtyDaysAgo;
  }).length;
  
  score += Math.min(60, (recentAppointments / 100) * 60);
  
  return Math.round(score);
}
