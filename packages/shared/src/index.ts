import { KloqoRole } from './constants/roles';

// ─── Kloqo IoC Layer ─────────────────────────────────────────────────────────
export { KloqoProvider, useKloqo } from './context/KloqoContext';
export type { KloqoIntegrator } from './context/KloqoContext';

// ─── Shared Appointment Hooks ─────────────────────────────────────────────────
export { useAppointmentMutations } from './hooks/appointments/useAppointmentMutations';
export { useAppointmentQueue } from './hooks/appointments/useAppointmentQueue';


export interface PaginationParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
  clinicId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BaseEntity {
  id: string;
  createdAt?: any;
  updatedAt?: any;
  isDeleted?: boolean;
}

export interface BreakPeriod {
  id: string;
  startTime: string; // HH:mm or ISO
  endTime: string; // HH:mm or ISO
  startTimeFormatted: string; // Display Only
  endTimeFormatted: string; // Display Only
  duration: number; // minutes
  sessionIndex: number;
  slots: string[]; // HH:mm strings
  date?: string; // For app-side filtering
  sessionExtension?: number; // Minutes added to session
  type?: string; 
  createdAt?: string;
  actualShiftMinutes?: number; // REAL delay applied (Gap Absorption result)
}

export interface Review {
  id: string;
  appointmentId: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientName: string;
  rating: number;
  feedback: string;
  createdAt: any;
  clinicId: string;
}


export interface TimeSlot {
  index: number;
  time: string; // HH:mm
  sessionIndex: number;
}

export type AvailabilitySlot = DoctorAvailability;

export interface Slot {
  time: Date;
  status: 'available' | 'booked' | 'reserved' | 'blocked';
}

export interface SubsessionSlot {
  title: string;
  slots: Slot[];
}

export interface SessionSlot {
  title: string;
  subsessions: SubsessionSlot[];
}

export type SubsessionSlots = SubsessionSlot;
export type SessionSlots = SessionSlot;


export interface DoctorAvailability {
  day: string;
  timeSlots: { from: string; to: string; maxAdvanceAppointments?: number }[];
}

export interface DoctorOverride {
  isOff: boolean;
  slots?: { from: string; to: string }[];
}

export interface Doctor {
  id: string;
  name: string;
  email?: string;
  role?: Role; // Dual-Write Support
  roles?: Role[]; // Multi-Role Support
  clinicId: string;
  averageConsultingTime: number;
  availabilitySlots: DoctorAvailability[];
  department?: string;
  phone?: string;
  mobile?: string;
  qualifications?: string;
  registrationNumber?: string;
  consultationStatus?: 'In' | 'Out' | string;
  actualAverageConsultationTime?: number;
  actualAverageConsultationTimeUpdatedAt?: any;
  isDeleted?: boolean;
  userId?: string;
  updatedAt?: any;
  avatar?: string;
  breakPeriods?: Record<string, BreakPeriod[]>;
  doctorDelayMinutes?: number;
  schedule?: string;
  leaves?: { date: string; reason?: string }[];
  appointmentMoves?: Record<string, any>;
  consultationFee?: number;
  freeFollowUpDays?: number;
  availabilityExtensions?: Record<string, { sessions: { sessionIndex: number; totalExtendedBy: number; newEndTime: string; breaks?: any[] }[] }>;
  dateOverrides?: Record<string, DoctorOverride>; // date string "YYYY-MM-DD" -> explicit override state
  advanceBookingDays?: number;
  accessibleMenus?: string[];
  specialty?: string;
  experience?: number | string;
  experienceYears?: number;
  historicalData?: string;
  totalPatients?: number;
  todaysAppointments?: number;
  availability?: 'Available' | 'Unavailable' | string;
  bio?: string;
  degrees?: string[];
  rating?: number;
  reviews?: number;
  reviewList?: any[];
  preferences?: string;
  sessions?: any[];
  latitude?: number;
  longitude?: number;
}


export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  slotIndex?: number;
  sessionIndex?: number;
  status: 'Pending' | 'Confirmed' | 'Skipped' | 'Completed' | 'Cancelled' | 'No-show' | string;
  paymentStatus?: 'Unpaid' | 'Paid' | 'Processing';
  bookedVia: 'Advanced Booking' | 'Walk-in' | 'Online' | string;
  tokenNumber: string;
  classicTokenNumber?: string | number;
  numericToken?: number;
  numericClassicToken?: number;
  isPriority?: boolean;
  priorityAt?: any;
  isInBuffer?: boolean;
  bufferedAt?: any;
  skippedAt?: any;
  noShowAt?: any;
  createdAt?: any | Date | string;
  updatedAt?: any | Date | string;
  confirmedAt?: any | Date | string;
  completedAt?: any | Date | string;
  arrivedAt?: any | Date | string;
  arriveByTime?: string;
  isDeleted?: boolean;
  notes?: string;
  cancelledBy?: 'patient' | 'clinic' | 'system';
  cancellationReason?: string;
  cancelledByBreak?: any;
  isRescheduled?: boolean;
  previousAppointmentId?: string;
  age?: number;
  place?: string;
  communicationPhone?: string;
  prescriptionUrl?: string;
  pharmacyStatus?: 'pending' | 'dispensed' | 'abandoned';
  dispensedBy?: string;
  dispensedAt?: any;
  weight?: string;
  height?: string;
  dispensedValue?: number;
  abandonedReason?: string;
  doctor?: string; 
  noShowTime?: any;
  sex?: 'Male' | 'Female' | 'Other' | string;
  department?: string;
  treatment?: string;
  delay?: number;
  cutOffTime?: any;
  doctorDelayMinutes?: number;
  isForceBooked?: boolean;
  isSkipped?: boolean;
  reviewed?: boolean;
  reviewId?: string;
  lateMinutes?: number;
  whatsappConfirmationSent?: boolean;
  whatsappReminder5PMSent?: boolean;
  whatsappReminder7AMSent?: boolean;
  /**
   * ANALYTICS GUARDRAIL: Set to `true` only on ghost "dummy-break-patient" records
   * inserted by ScheduleBreakUseCase to hard-block slots from the booking engine.
   * Every analytics query MUST filter these out: `.filter(a => !a.isSystemBlocker)`
   */
  isSystemBlocker?: boolean;
}

export interface ActivityLog {
  id: string;
  type: 'SCHEDULING_CHANGE' | 'SYSTEM' | string;
  action: string;
  doctorId?: string;
  clinicId: string;
  performedBy: {
    id: string;
    name: string;
    role: string;
  };
  details: any;
  timestamp: any;
  expiresAt: any; // TTL field
}

export type ClinicType = 'Clinic' | 'Pharmacy';

export type ClinicCategory = 
  | 'In-House Clinic' 
  | 'Independent Premium' 
  | 'The Sponsored Split' 
  | 'True Solo' 
  | 'The Budget Scanner' 
  | 'Hyper-Solo';

export interface Clinic {
  id: string;
  clinicId?: string; // Mirrors document ID inside the document for frontend/webhook convenience
  name: string;
  type?: ClinicType;
  category?: ClinicCategory;
  address?: string;
  addressDetails?: {
    line1?: string;
    line2?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
  };
  city?: string;
  district?: string;
  registrationDate?: any;
  onboardingStatus?: string;
  currentDoctorCount?: number;
  numDoctors?: number;
  planStartDate?: any;
  registrationStatus?: string;
  ownerEmail?: string;
  ownerId?: string;
  clinicRegNumber?: string;
  trialEndDate?: any;
  latitude?: number;
  longitude?: number;
  mapsLink?: string;
  logoUrl?: string;
  licenseUrl?: string;
  receptionPhotoUrl?: string | null;
  plan?: string;
  billingCycle?: 'monthly' | 'annually' | string;
  hardwareChoice?: 'upfront' | 'emi' | 'byot' | string;
  hardwareDeployment?: 'immediate' | 'delayed' | string;
  calculatedMonthlyTotal?: number;
  calculatedOneTimeTotal?: number;
  plannedUpfrontTotal?: number;
  paymentDetails?: {
    paymentId: string;
    orderId: string;
    signature: string;
  };
  walkInTokenAllotment?: number;
  departments?: string[];
  shortCode?: string;
  genderPreference?: 'Men' | 'Women' | 'General';
  tokenDistribution?: 'classic' | 'advanced';
  showEstimatedWaitTime?: boolean;
  operatingHours?: {
    day: string;
    isClosed: boolean;
    timeSlots: { open: string; close: string }[];
  }[];
  subscriptionDetails?: {
    subscriptionId: string | null;
    subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'paused';
    renewalType: 'auto-debit' | 'manual-upi';
    isTrialPeriod: boolean;
    nextBillingDate: Date | null | any;
    lastPaymentDate: Date | null | any;
    gracePeriodEndDate: Date | null | any;
    failureReason: string | null;
    expectedNextInvoice?: number;
  };
  usage?: {
    whatsapp?: {
      monthlyLimit: number;
      currentMonthCount: number;
      totalEverSent: number;
      isUnlimited: boolean;
      lastMessageAt: Date | null | any;
      nextResetDate: Date | null | any;
      additionalCredits: number;
    };
  };
  pharmacyPhone?: string;
  isDeleted?: boolean;
  createdAt?: any;
  updatedAt?: any;
  sponsoredBy?: string; // Pharmacy ID
}

export interface Subscription {
  id: string;
  clinicId: string;
  planId: string;
  status: 'active' | 'past_due' | 'cancelled' | 'trialing';
  currentPeriodEnd: any;
  razorpaySubscriptionId?: string;
  razorpayPlanId?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email?: string;
  age?: number;
  sex?: 'Male' | 'Female' | 'Other' | '';
  weight?: string;
  height?: string;
  createdAt?: any | Date | string;
  clinicIds?: string[];
  place?: string;
  communicationPhone?: string;
  isLinkPending?: boolean;
  isDeleted?: boolean;
  updatedAt?: any;
  relatedPatientIds?: string[];
  isKloqoMember?: boolean;
  primaryUserId?: string;
  totalAppointments?: number;
  visitHistory?: any[];
  isPrimary?: boolean;
}


export interface User {
  id?: string;
  email?: string;
  name?: string;
  role: Role; // DEPRECATED: Slated for removal in Phase 4
  roles?: Role[]; // NEW: The unified identity array
  clinicId?: string;
  phoneNumber?: string;
  dbUserId?: string;
  doctorName?: string;
  phone?: string;
  patientId?: string;
  uid?: string;
  accessibleMenus?: string[];
  avatar?: string;
  assignedDoctorIds?: string[];
  isDoctor?: boolean; 
  clinicIds?: string[];
  pwaInstalled?: boolean;
  createdAt?: any;
  updatedAt?: any;
  isDeleted?: boolean; 
  mustChangePassword?: boolean;
}

export interface TrafficData {
  id: string;
  sessionId: string;
  visitorId?: string;
  phone?: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | string;
  entryPage: string;
  referrer: string;
  sessionStart: string | Date | any;
  sessionDuration?: number;
  createdAt: Date | any;
}

export interface Department {
  id: string;
  name: string;
  name_ml: string;
  description: string;
  description_ml: string;
  doctors: string[];
  icon: string;
  isDeleted?: boolean;
}

export interface CampaignSend {
  id: string;
  ref: string;
  campaign: string;
  medium: string;
  phoneNumber: string;
  sentAt: Date | any;
}

export interface MarketingAnalytics {
  id: string;
  sessionId: string;
  visitorId?: string;
  phone?: string;
  ref: string;
  campaign: string;
  sessionDuration: number;
  pageFlow?: string;
  pageCount?: number;
  actions?: string[];
  deviceType?: string;
  sessionStart: string | Date | any;
  isBot?: boolean;
}

export interface MarketingInteraction {
  id: string;
  sessionId: string;
  visitorId?: string;
  phone?: string;
  buttonText: string;
  timestamp: Date | any;
  ref?: string;
  campaign?: string;
}

export interface WhatsappSession {
  phoneNumber: string;
  clinicId: string;
  lastMessageAt: Date | any;
  isWindowOpen?: boolean;
}

export interface CampaignMetrics {
  ref: string;
  campaign: string;
  medium: string;
  totalLinksSent: number;
  totalClicks: number;
  totalSessions: number;
  totalActions: number;
  ctr: number;
  conversionRate: number;
  avgSessionDuration: number;
  avgPagesPerSession: number;
  bounceRate: number;
}

export const NOTIFICATION_TYPES = {
  APPOINTMENT_BOOKED_BY_STAFF: 'appointment_booked_by_staff',
  ARRIVAL_CONFIRMED: 'arrival_confirmed',
  TOKEN_CALLED: 'token_called',
  APPOINTMENT_CANCELLED: 'appointment_cancelled',
  DOCTOR_RUNNING_LATE: 'doctor_running_late',
  BREAK_UPDATE: 'break_update',
  APPOINTMENT_SKIPPED: 'appointment_skipped',
  PEOPLE_AHEAD: 'people_ahead',
  DOCTOR_CONSULTATION_STARTED: 'doctor_consultation_started',
  DAILY_REMINDER: 'daily_reminder',
  FREE_FOLLOWUP_EXPIRY: 'free_followup_expiry',
  CONSULTATION_COMPLETED: 'consultation_completed',
  AI_FALLBACK: 'ai_fallback',
  BOOKING_LINK: 'booking_link',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

export interface NotificationConfig {
  id: string;
  name: string;
  description: string;
  whatsappEnabled: boolean;
  pwaEnabled: boolean;
  category: 'booking' | 'status' | 'queue' | 'reminder' | 'follow-up';
  channels: ('whatsapp' | 'pwa')[];
  updatedAt: any;
  updatedBy?: string;
}

export const NOTIFICATION_METADATA: Record<NotificationType, { name: string; description: string; category: NotificationConfig['category']; channels: NotificationConfig['channels'] }> = {
  [NOTIFICATION_TYPES.APPOINTMENT_BOOKED_BY_STAFF]: {
      name: 'Appointment Booked by Staff',
      description: 'Sent when nurse/admin books an appointment for a patient',
      category: 'booking',
      channels: ['whatsapp', 'pwa'],
  },
  [NOTIFICATION_TYPES.ARRIVAL_CONFIRMED]: {
      name: 'Arrival Confirmed',
      description: 'Sent when patient arrives at clinic. (WA Templates: walkin_arrival_confirmed_malayalam / appointment_status_confirmed_mlm)',
      category: 'status',
      channels: ['whatsapp', 'pwa'],
  },
  [NOTIFICATION_TYPES.TOKEN_CALLED]: {
      name: 'Token Called',
      description: 'Sent when patient\'s token is called for consultation. (WA Template: token_called_quick_reply_ml)',
      category: 'queue',
      channels: ['whatsapp', 'pwa'],
  },
  [NOTIFICATION_TYPES.APPOINTMENT_CANCELLED]: {
      name: 'Appointment Cancelled',
      description: 'Sent when an appointment is cancelled. (WA Template: appointment_cancelled_ml)',
      category: 'status',
      channels: ['whatsapp', 'pwa'],
  },
  [NOTIFICATION_TYPES.DOCTOR_RUNNING_LATE]: {
      name: 'Doctor Running Late',
      description: 'Sent when doctor is running behind schedule',
      category: 'status',
      channels: ['whatsapp', 'pwa'],
  },
  [NOTIFICATION_TYPES.BREAK_UPDATE]: {
      name: 'Break Update',
      description: 'Sent when doctor takes a break affecting patient appointments',
      category: 'status',
      channels: ['whatsapp', 'pwa'],
  },
  [NOTIFICATION_TYPES.APPOINTMENT_SKIPPED]: {
      name: 'Appointment Skipped',
      description: 'Sent when patient misses their appointment window',
      category: 'status',
      channels: ['whatsapp', 'pwa'],
  },
  [NOTIFICATION_TYPES.PEOPLE_AHEAD]: {
      name: 'Queue Updates (People Ahead)',
      description: 'Sent to inform patients about their position in queue',
      category: 'queue',
      channels: ['whatsapp', 'pwa'],
  },
  [NOTIFICATION_TYPES.DOCTOR_CONSULTATION_STARTED]: {
      name: 'Doctor Consultation Started',
      description: 'Sent when doctor starts consultation with a patient',
      category: 'queue',
      channels: ['whatsapp', 'pwa'],
  },
  [NOTIFICATION_TYPES.DAILY_REMINDER]: {
      name: 'Daily Reminder (5 PM / 7 AM)',
      description: 'Batch reminders sent at 5 PM (next day) and 7 AM (same day)',
      category: 'reminder',
      channels: ['whatsapp', 'pwa'],
  },
  [NOTIFICATION_TYPES.FREE_FOLLOWUP_EXPIRY]: {
      name: 'Free Follow-Up Expiry',
      description: 'Sent when free follow-up period is about to expire',
      category: 'follow-up',
      channels: ['whatsapp', 'pwa'],
  },
  [NOTIFICATION_TYPES.CONSULTATION_COMPLETED]: {
      name: 'Consultation Completed (Checkout)',
      description: 'Sent when a patient\'s consultation is finished',
      category: 'status',
      channels: ['pwa'],
  },
  [NOTIFICATION_TYPES.AI_FALLBACK]: {
      name: 'AI Fallback Link',
      description: 'Sent when consultation cannot be booked via WhatsApp AI bot',
      category: 'booking',
      channels: ['whatsapp'],
  },
  [NOTIFICATION_TYPES.BOOKING_LINK]: {
      name: 'Direct Booking Link',
      description: 'Sent when a direct booking link is requested or shared',
      category: 'booking',
      channels: ['whatsapp'],
  },
};

export interface PunctualityLog {
  id: string;
  clinicId: string;
  doctorId: string;
  doctorName: string;
  date: string;
  sessionIndex: number | null;
  type: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END' | 'EXTENSION';
  timestamp: any;
  scheduledTime: string | null;
  metadata: any;
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  userId?: string;
  userRole?: string;
  page?: string;
  action?: string;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    language: string;
    screenWidth?: number;
    screenHeight?: number;
  };
  appVersion?: string;
  [key: string]: any;
}

export interface ErrorLog {
  id: string;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  severity: ErrorSeverity;
  context: ErrorContext;
  timestamp: any;
  appName: 'patient-app' | 'nurse-app' | 'clinic-admin';
  sessionId?: string;
}

export interface ErrorStats {
  total: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byApp: {
    'patient-app': number;
    'nurse-app': number;
    'clinic-admin': number;
  };
  today: number;
  last24Hours: number;
}

export interface GrowthDataPoint {
  date: string; // YYYY-MM
  clinics: number;
  patients: number;
  appointments: number;
}

export interface PatientAnalytics {
  registrationTrends: Array<{ date: string; count: number }>;
  segmentation: {
    new: number;
    returning: number;
  };
  demographics: {
    ageGroups: Array<{ name: string; value: number }>;
    gender: Array<{ name: string; value: number }>;
  };
  punctuality: {
    punctuality: number;
    avgWait: number;
    meetingEfficiency: number;
    total: number;
    punctualCount: number;
    confirmedCount: number;
    efficientCount: number;
    completedCount: number;
    waitCount: number;
  };
}

export interface SuperadminDashboardData {
  metrics: {
    totalClinics: number;
    activeClinics: number;
    totalPatients: number;
    totalAppointments: number;
    mau: number;
    retention: number;
  };
  recentTraffic: TrafficData[];
  growthData: GrowthDataPoint[];
  patientsAnalytics?: PatientAnalytics;
}

export interface QueueState {
  arrivedQueue: Appointment[];
  bufferQueue: Appointment[];
  priorityQueue?: Appointment[];
  skippedQueue: Appointment[];
  currentConsultation: Appointment | null;
  consultationCount: number;
  nextBreakDuration: number | null;
}

export function compareAppointments(a: Appointment, b: Appointment): number {
  if (a.isPriority && !b.isPriority) return -1;
  if (!a.isPriority && b.isPriority) return 1;
  if (a.isPriority && b.isPriority) {
    const pA = (a.priorityAt as any)?.seconds || 0;
    const pB = (b.priorityAt as any)?.seconds || 0;
    return pA - pB;
  }

  const sA = a.sessionIndex ?? 0;
  const sB = b.sessionIndex ?? 0;
  if (sA !== sB) return sA - sB;

  if (a.isInBuffer && !b.isInBuffer) return -1;
  if (!a.isInBuffer && b.isInBuffer) return 1;

  if (a.isInBuffer && b.isInBuffer) {
    const bufferTimeA = (a.bufferedAt as any)?.toMillis ? (a.bufferedAt as any).toMillis() : 0;
    const bufferTimeB = (b.bufferedAt as any)?.toMillis ? (b.bufferedAt as any).toMillis() : 0;
    if (bufferTimeA && bufferTimeB && bufferTimeA !== bufferTimeB) {
      return bufferTimeA - bufferTimeB;
    }
  }

  try {
    const timeA = new Date(`2000-01-01 ${a.time}`);
    const timeB = new Date(`2000-01-01 ${b.time}`);

    if (timeA.getTime() !== timeB.getTime()) {
      return timeA.getTime() - timeB.getTime();
    }

    const isASkipped = !!a.skippedAt;
    const isBSkipped = !!b.skippedAt;
    if (isASkipped !== isBSkipped) {
      return isASkipped ? -1 : 1;
    }

    return (a.numericToken || 0) - (b.numericToken || 0);
  } catch (e) {
    return (a.numericToken || 0) - (b.numericToken || 0);
  }
}

export function compareAppointmentsClassic(a: Appointment, b: Appointment): number {
  if (a.isPriority && !b.isPriority) return -1;
  if (!a.isPriority && b.isPriority) return 1;
  if (a.isPriority && b.isPriority) {
    const pA = ((a.priorityAt as any)?.seconds || 0) * 1000;
    const pB = ((b.priorityAt as any)?.seconds || 0) * 1000;
    return pA - pB;
  }

  const sA = a.sessionIndex ?? 0;
  const sB = b.sessionIndex ?? 0;
  if (sA !== sB) return sA - sB;

  const getMillis = (val: any) => {
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    return new Date(val).getTime();
  };

  const confirmedA = getMillis(a.confirmedAt);
  const confirmedB = getMillis(b.confirmedAt);

  if (confirmedA && confirmedB) {
    if (confirmedA !== confirmedB) {
      return confirmedA - confirmedB;
    }
  } else if (confirmedA) {
    return -1;
  } else if (confirmedB) {
    return 1;
  }

  return compareAppointments(a, b);
}

export interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface Prescription {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  appointmentId?: string;
  medicines?: Medicine[];
  prescriptionImageUrl?: string; // For iPad stylus uploads
  notes?: string;
  date: any;
  createdAt: any;
  status: 'DRAFT' | 'ISSUED_WHATSAPP' | 'ISSUED_PRINTED' | 'FULFILLED' | 'WALK_OUT';
  issuanceMethod?: 'WHATSAPP' | 'PRINTED';
  totalAmountBilled?: number;
  estimatedValue?: number;
  fulfilledAt?: any;
}

import { format, parse, addMinutes, isAfter, differenceInMinutes, parseISO } from 'date-fns';

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Helper function to easily parse Appointment string times into Date objects
export function parseAppointmentTime(apt: Appointment): Date | null {
  try {
      if (!apt.date || !apt.time) return null;
      // We do not have parseTime in shared yet, so build a pure JS date string parser
      const datePart = apt.date; // e.g., "15 March 2026"
      const timePart = apt.time; // e.g., "09:30 AM"
      const d = parse(`${datePart} ${timePart}`, 'd MMMM yyyy hh:mm a', new Date());
      return isNaN(d.getTime()) ? null : d;
  } catch {
      return null;
  }
}

// Simulate where a skipped appointment would be placed if it rejoined now
export function simulateSkippedRejoinTime(skippedAppointment: Appointment, now: Date = new Date()): Date | null {
  try {
      if (!skippedAppointment.time || !skippedAppointment.noShowAt) return null;

      const scheduledTime = parseAppointmentTime(skippedAppointment);
      if (!scheduledTime) return null;

      let noShowDate: Date;
      if ((skippedAppointment.noShowAt as any)?.toDate) {
          noShowDate = (skippedAppointment.noShowAt as any).toDate();
      } else {
          noShowDate = new Date(skippedAppointment.noShowAt as any);
      }

      if (isNaN(noShowDate.getTime())) return null;

      if (isAfter(now, scheduledTime)) {
          // Current time past the 'time' -> noShowTime + 15 minutes
          return addMinutes(noShowDate, 15);
      } else {
          // Current time didn't pass 'time' -> bare noShowTime
          return noShowDate;
      }
  } catch (error) {
      console.error('Error simulating skipped rejoin time:', error);
      return null;
  }
}

// Centralized generic queue builder for predicted UI representation
export function buildSimulatedQueue(
  allAppointmentsForDoctorAndDate: Appointment[],
  tokenDistribution: 'classic' | 'advanced' | string = 'classic',
  now: Date = new Date(),
  targetAppointmentId?: string
): Appointment[] {
  // Get Pending and Confirmed appointments (these are at their current positions)
  const pendingAndConfirmed = allAppointmentsForDoctorAndDate.filter(apt =>
      apt.status === 'Pending' || apt.status === 'Confirmed'
  );

  // Identify patient's natural position if passing targetId
  let isTopPosition = false;
  let yourAppointmentTime: Date | null = null;
  
  if (targetAppointmentId) {
      const yourApt = allAppointmentsForDoctorAndDate.find(a => a.id === targetAppointmentId);
      if (yourApt) {
          yourAppointmentTime = parseAppointmentTime(yourApt);
          const yourNaturalIndex = pendingAndConfirmed.findIndex(a => a.id === targetAppointmentId);
          isTopPosition = yourNaturalIndex !== -1 && yourNaturalIndex <= 1; // 1st or 2nd
      }
  }

  // Get Skipped appointments (simulate where they will be placed if rejoined now)
  const skippedAppointments = allAppointmentsForDoctorAndDate.filter(apt =>
      apt.status === 'Skipped' && apt.id !== targetAppointmentId
  );

  const simulatedSkippedAppointments: Array<{ appointment: Appointment; simulatedTime: Date }> = [];
  for (const skipped of skippedAppointments) {
      const simulatedTime = simulateSkippedRejoinTime(skipped, now);
      if (simulatedTime) {
          simulatedSkippedAppointments.push({ 
              appointment: { ...skipped, time: format(simulatedTime, 'hh:mm a') }, 
              simulatedTime 
          });
      }
  }

  // Build the complete queue: pending/confirmed + simulated skipped
  const queue: Array<{ appointment: Appointment; queueTime: Date }> = [];

  for (const apt of pendingAndConfirmed) {
      if (isTopPosition && apt.status === 'Pending' && apt.id !== targetAppointmentId) {
          continue; // stability constraint
      }
      const aptTime = parseAppointmentTime(apt) || new Date(0);
      queue.push({ appointment: apt, queueTime: aptTime });
  }

  if (!isTopPosition && yourAppointmentTime) {
      for (const { appointment, simulatedTime } of simulatedSkippedAppointments) {
          if (simulatedTime.getTime() < yourAppointmentTime.getTime()) {
              queue.push({ appointment, queueTime: simulatedTime });
          }
      }
  } else if (!targetAppointmentId) {
     // If building entire queue generally (e.g. nurse/admin end or total count)
     for (const { appointment, simulatedTime } of simulatedSkippedAppointments) {
        queue.push({ appointment, queueTime: simulatedTime });
     }
  }

  queue.sort((a, b) => (tokenDistribution === 'classic' 
      ? compareAppointmentsClassic(a.appointment, b.appointment) 
      : compareAppointments(a.appointment, b.appointment)
  ));

  return queue.map(item => item.appointment);
}

export function calculateDelayForAppointments(
    appointments: Appointment[],
    currentTokenAppointment: Appointment | null | undefined,
    avgConsultingTime: number,
    currentTime: Date
): Map<string, number> {
    const delayMap = new Map<string, number>();

    if (!currentTokenAppointment || appointments.length === 0) {
        return delayMap;
    }

    const currentIndex = appointments.findIndex(apt => apt.id === currentTokenAppointment.id);
    if (currentIndex === -1) return delayMap;

    try {
        const scheduledTime = parseAppointmentTime(currentTokenAppointment);
        if (!scheduledTime) return delayMap;
        
        const currentDelay = Math.max(0, differenceInMinutes(currentTime, scheduledTime));

        delayMap.set(currentTokenAppointment.id, 0);
        let accumulatedDelay = currentDelay;

        for (let i = currentIndex + 1; i < appointments.length; i++) {
            const appointment = appointments[i];
            const prevAppointment = appointments[i - 1];

            const currentScheduledTime = parseAppointmentTime(appointment);
            const prevScheduledTime = parseAppointmentTime(prevAppointment);
            if (!currentScheduledTime || !prevScheduledTime) continue;

            const gapBetweenSlots = differenceInMinutes(currentScheduledTime, prevScheduledTime);

            if (gapBetweenSlots > avgConsultingTime) {
                const absorbedDelay = gapBetweenSlots - avgConsultingTime;
                accumulatedDelay = Math.max(0, accumulatedDelay - absorbedDelay);
            }

            delayMap.set(appointment.id, Math.round(accumulatedDelay));
        }
    } catch (error) {
        console.error('Error calculating delays:', error);
    }

    return delayMap;
}
export interface PatientFormProps {
  selectedDoctor: Doctor;
  appointmentType: 'Walk-in' | 'Online';
  renderLoadingOverlay?: (isLoading: boolean) => React.ReactNode;
}

export type FormValues = {
  selectedPatient?: string;
  name: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  place: string;
  phone?: string;
};

// Exporting a basic version, apps can override it
export const createFormSchema = (t: any) => ({}); 

export type Role = KloqoRole; // Alias for backward compatibility

export * from './utils/rbac';
export * from './constants/roles';
