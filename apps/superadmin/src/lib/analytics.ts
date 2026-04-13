import { Clinic, Department, CampaignMetrics, CampaignSend, MarketingAnalytics, MarketingInteraction, WhatsappSession, User, Patient, Appointment, TrafficData, NotificationConfig, PunctualityLog, ErrorLog, SuperadminDashboardData } from '@kloqo/shared';
export type { Clinic, Department, CampaignMetrics, CampaignSend, MarketingAnalytics, MarketingInteraction, WhatsappSession, User, Patient, Appointment, TrafficData, NotificationConfig, PunctualityLog, ErrorLog, SuperadminDashboardData };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const getHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

/**
 * Fetch dashboard data from the backend
 */
export async function fetchDashboardData(startDate?: string, endDate?: string): Promise<SuperadminDashboardData> {
  const url = new URL(`${API_URL}/superadmin/dashboard`);
  if (startDate) url.searchParams.append('startDate', startDate);
  if (endDate) url.searchParams.append('endDate', endDate);
  
  const response = await fetch(url.toString(), {
    headers: getHeaders()
  });
  if (response.status === 401) throw new Error('Unauthorized');
  if (!response.ok) throw new Error('Failed to fetch dashboard data');
  return response.json();
}

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
 * Convert Firestore timestamp to Date
 */
export function firestoreTimestampToDate(timestamp: any): Date | null {
  if (!timestamp) return null;
  
  // 1. Array of timestamps (common in some fields)
  if (Array.isArray(timestamp)) return firestoreTimestampToDate(timestamp[0]);
  
  // 2. Native Firestore Timestamp
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  
  // 3. Plain object map (legacy or JSON)
  const seconds = timestamp._seconds ?? timestamp.seconds;
  if (seconds !== undefined) {
    const nanos = timestamp._nanoseconds ?? timestamp.nanoseconds ?? 0;
    return new Date(seconds * 1000 + (nanos / 1000000));
  }
  
  // 4. ISO String or already a Date
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Fetch all users (paginated)
 */
export async function fetchAllUsers(page?: number, limit?: number): Promise<User[] | { data: User[]; total: number; page: number; limit: number }> {
  const url = new URL(`${API_URL}/superadmin/users`);
  if (page) url.searchParams.append('page', page.toString());
  if (limit) url.searchParams.append('limit', limit.toString());
  
  const response = await fetch(url.toString(), {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch users');
  return response.json();
}

/**
 * Delete a user (soft delete by default)
 */
export async function deleteUser(userId: string, soft: boolean = true): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/users/${userId}?soft=${soft}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to delete user');
}

/**
 * Fetch paginated clinics
 */
export async function fetchAllClinics(page?: number, limit?: number): Promise<Clinic[] | { data: Clinic[]; total: number; page: number; limit: number }> {
  const url = new URL(`${API_URL}/superadmin/clinics`);
  if (page) url.searchParams.append('page', page.toString());
  if (limit) url.searchParams.append('limit', limit.toString());
  
  const response = await fetch(url.toString(), {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch clinics');
  return response.json();
}

/**
 * Fetch paginated patients
 */
export async function fetchAllPatients(page?: number, limit?: number): Promise<Patient[] | { data: Patient[]; total: number; page: number; limit: number }> {
  const url = new URL(`${API_URL}/superadmin/patients`);
  if (page) url.searchParams.append('page', page.toString());
  if (limit) url.searchParams.append('limit', limit.toString());
  
  const response = await fetch(url.toString(), {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch patients');
  return response.json();
}

/**
 * Fetch patients by communication phone
 */
export async function fetchPatientsByPhone(phone: string): Promise<Patient[]> {
  const data = await fetchDashboardData() as any;
  return data.patients.filter((p: any) => p.phone === phone || p.communicationPhone === phone);
}

/**
 * Fetch clinic by ID
 */
export async function fetchClinicById(id: string): Promise<Clinic | null> {
  const data = await fetchDashboardData() as any;
  return data.clinics.find((c: any) => c.id === id) || null;
}

/**
 * Fetch patient by ID
 */
export async function fetchPatientById(id: string): Promise<Patient | null> {
  const data = await fetchDashboardData() as any;
  return data.patients.find((p: any) => p.id === id) || null;
}

/**
 * Fetch appointments for a specific patient
 */
export async function fetchAppointmentsByPatientId(patientId: string): Promise<Appointment[]> {
  const data = await fetchDashboardData() as any;
  return data.appointments.filter((a: any) => a.patientId === patientId);
}

/**
 * Fetch all appointments
 */
export async function fetchAllAppointments(page?: number, limit?: number): Promise<Appointment[] | { data: Appointment[]; total: number; page: number; limit: number }> {
  const url = new URL(`${API_URL}/superadmin/appointments`);
  if (page) url.searchParams.append('page', page.toString());
  if (limit) url.searchParams.append('limit', limit.toString());
  
  const response = await fetch(url.toString(), {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch appointments');
  return response.json();
}

/**
 * Fetch appointments for a specific date range
 */
export async function fetchAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
  const data = await fetchDashboardData() as any;
  return data.appointments.filter((apt: any) => {
    const aptDate = apt.createdAt ? (apt.createdAt.seconds ? new Date(apt.createdAt.seconds * 1000) : new Date(apt.createdAt)) : null;
    if (!aptDate) return false;
    return aptDate >= startDate && aptDate <= endDate;
  });
}

/**
 * Fetch filtered traffic data from backend
 */
export async function fetchTrafficAnalytics(start?: string, end?: string): Promise<TrafficData[]> {
  const url = new URL(`${API_URL}/superadmin/traffic`);
  if (start) url.searchParams.append('start', start);
  if (end) url.searchParams.append('end', end);
  
  const response = await fetch(url.toString(), {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch traffic analytics');
  return response.json();
}

/**
 * Fetch all app traffic data (legacy wrapper)
 */
export async function fetchTrafficData(): Promise<TrafficData[]> {
  return fetchTrafficAnalytics();
}

/**
 * Calculate growth trends over time periods
 */
export function calculateGrowthTrends(
  appointments: Appointment[],
  days: number = 90
): Array<{ date: string; count: number }> {
  const now = new Date();
  const trends: Map<string, number> = new Map();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    trends.set(dateStr, 0);
  }

  appointments.forEach((apt) => {
    let aptDate = firestoreTimestampToDate(apt.createdAt);
    if (!aptDate && apt.date) {
      aptDate = parseDateString(apt.date);
    }

    // Still no date? Fallback to updatedAt or some other field if available
    if (!aptDate && (apt as any).updatedAt) {
      aptDate = firestoreTimestampToDate((apt as any).updatedAt);
    }

    if (!aptDate || isNaN(aptDate.getTime())) return;

    const dateStr = aptDate.toISOString().split('T')[0];
    if (trends.has(dateStr)) {
      trends.set(dateStr, (trends.get(dateStr) || 0) + 1);
    }
  });

  return Array.from(trends.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fetch doctor punctuality logs from backend
 */
export async function fetchPunctualityLogs(doctorId?: string): Promise<PunctualityLog[]> {
  const url = new URL(`${API_URL}/superadmin/punctuality`);
  if (doctorId) url.searchParams.append('doctorId', doctorId);
  
  const response = await fetch(url.toString(), {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch punctuality logs');
  return response.json();
}

/**
 * Fetch error logs from backend
 */
export async function fetchErrorLogs(page?: number, limit?: number): Promise<ErrorLog[] | { data: ErrorLog[]; total: number; page: number; limit: number }> {
  const url = new URL(`${API_URL}/superadmin/errors`);
  if (page) url.searchParams.append('page', page.toString());
  if (limit) url.searchParams.append('limit', limit.toString());
  
  const response = await fetch(url.toString(), {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch error logs');
  return response.json();
}

/**
 * Update clinic details
 */
export async function updateClinic(clinicId: string, data: Partial<Clinic>): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/clinics/${clinicId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update clinic');
}

/**
 * Create a new clinic
 */
export async function createClinic(data: Clinic): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/clinics`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to create clinic');
}

/**
 * Delete a clinic (soft delete by default)
 */
export async function deleteClinic(clinicId: string, soft: boolean = true): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/clinics/${clinicId}?soft=${soft}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to delete clinic');
}

/**
 * Update clinic registration status
 */
export async function updateClinicStatus(clinicId: string, status: 'Approved' | 'Rejected' | 'Pending'): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/clinics/status`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ clinicId, status })
  });
  if (!response.ok) throw new Error('Failed to update clinic status');
}

/**
 * Fetch detailed doctor information including calculated KPIs
 */
export async function fetchDoctorDetails(doctorId: string): Promise<any> {
    const response = await fetch(`${API_URL}/superadmin/doctors/${doctorId}`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch doctor details');
    return response.json();
}

/**
 * Fetch all departments (optional pagination)
 */
export async function fetchDepartments(page?: number, limit?: number): Promise<Department[] | { data: Department[]; total: number; page: number; limit: number }> {
  const url = new URL(`${API_URL}/superadmin/departments`);
  if (page) url.searchParams.append('page', page.toString());
  if (limit) url.searchParams.append('limit', limit.toString());
  
  const response = await fetch(url.toString(), {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch departments');
  return response.json();
}

/**
 * Save a new department or update an existing one
 */
export async function saveDepartment(department: Department): Promise<void> {
  const isUpdate = !!department.id;
  const url = isUpdate ? `${API_URL}/superadmin/departments/${department.id}` : `${API_URL}/superadmin/departments`;
  const method = isUpdate ? 'PATCH' : 'POST';

  const response = await fetch(url, {
    method,
    headers: getHeaders(),
    body: JSON.stringify(department)
  });
  if (!response.ok) throw new Error('Failed to save department');
}

/**
 * Delete a department (soft delete)
 */
export async function deleteDepartment(departmentId: string): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/departments/${departmentId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to delete department');
}

/**
 * Fetch paginated doctors
 */
export async function fetchAllDoctors(page?: number, limit?: number): Promise<any[] | { data: any[]; total: number; page: number; limit: number }> {
  const url = new URL(`${API_URL}/superadmin/doctors`);
  if (page) url.searchParams.append('page', page.toString());
  if (limit) url.searchParams.append('limit', limit.toString());
  
  const response = await fetch(url.toString(), {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch doctors');
  return response.json();
}

/**
 * Create a new doctor
 */
export async function createDoctor(data: any): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/doctors`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to create doctor');
}

/**
 * Delete a doctor (soft delete by default)
 */
export async function deleteDoctor(doctorId: string, soft: boolean = true): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/doctors/${doctorId}?soft=${soft}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to delete doctor');
}

/**
 * Marketing Analytics
 */
export async function fetchMarketingAnalytics(start?: string, end?: string): Promise<any> {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const response = await fetch(`${API_URL}/superadmin/marketing/analytics?${params.toString()}`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch marketing analytics');
    return response.json();
}

/**
 * Search Patient Journey
 */
export async function searchPatientJourney(phone: string): Promise<any> {
    const response = await fetch(`${API_URL}/superadmin/marketing/search?phone=${encodeURIComponent(phone)}`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error('Failed to search patient journey');
    return response.json();
}

/**
 * Get patient's first booking date
 */
export function getPatientFirstBooking(patientId: string, appointments: Appointment[]): Date | null {
  const patientAppointments = appointments
    .filter(a => a.patientId === patientId)
    .map(a => firestoreTimestampToDate(a.createdAt))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
    
  return patientAppointments.length > 0 ? patientAppointments[0] : null;
}

/**
 * Get patient's last active date
 */
export function getPatientLastActive(patientId: string, appointments: Appointment[]): Date | null {
  const patientAppointments = appointments
    .filter(a => a.patientId === patientId)
    .map(a => firestoreTimestampToDate(a.createdAt))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime());
    
  return patientAppointments.length > 0 ? patientAppointments[0] : null;
}

/**
 * Fetch all notification configurations
 */
export async function fetchNotificationConfigs(): Promise<NotificationConfig[]> {
  const response = await fetch(`${API_URL}/superadmin/notifications/configs`, {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch notification configurations');
  return response.json();
}

/**
 * Update a specific notification configuration
 */
export async function updateNotificationConfig(id: string, data: Partial<NotificationConfig>): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/notifications/configs/${id}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update notification configuration');
}

/**
 * Reset all notification configurations to defaults
 */
export async function resetNotificationConfigs(): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/notifications/configs/reset`, {
    method: 'POST',
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to reset notification configurations');
}
/**
 * Delete a patient (soft delete by default)
 */
export async function deletePatient(patientId: string, soft: boolean = true): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/patients/${patientId}?soft=${soft}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to delete patient');
}
/**
 * Fetch global system settings (Super Admin)
 */
export async function fetchSystemSettings(): Promise<{ isWhatsAppEnabled: boolean }> {
  const response = await fetch(`${API_URL}/superadmin/settings`, {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch settings');
  return response.json();
}

/**
 * Update global system settings
 */
export async function updateSystemSettings(data: { isWhatsAppEnabled: boolean }): Promise<void> {
  const response = await fetch(`${API_URL}/superadmin/settings`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update settings');
}

/**
 * Fetch investor metrics
 */
export async function fetchInvestorMetrics(): Promise<any> {
  const response = await fetch(`${API_URL}/superadmin/investor-metrics`, {
    headers: getHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch investor metrics');
  return response.json();
}
