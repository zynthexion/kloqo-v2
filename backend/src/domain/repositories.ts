import { Clinic, User, Patient, Appointment, TrafficData, Department, Doctor, CampaignSend, MarketingAnalytics, MarketingInteraction, WhatsappSession, NotificationConfig, PunctualityLog, ErrorLog, PaginationParams, PaginatedResponse, Prescription, Subscription, DoctorOverride } from '../../../packages/shared/src/index';

/**
 * ITransaction
 *
 * Opaque wrapper around a Firestore Transaction.
 * Named generically so the domain layer stays infrastructure-agnostic.
 * ⚠️ DO NOT use the global `ITransaction` name — that is the browser IndexedDB type.
 */
export interface ITransaction {}

export type { WhatsappSession };

export interface IDepartmentRepository {
  findAll(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Department> | Department[]>;
  findById(id: string, clinicId: string): Promise<Department | null>;
  save(department: Department, clinicId: string): Promise<void>;
  update(id: string, clinicId: string, department: Partial<Department>): Promise<void>;
  delete(id: string, clinicId: string, soft?: boolean, transaction?: ITransaction): Promise<void>;
  countAll(clinicId: string): Promise<number>;
  countByClinicId(clinicId: string): Promise<number>;
}

export interface IAppointmentRepository {
  findAll(params?: Partial<PaginationParams> & { clinicId?: string; doctorId?: string }): Promise<PaginatedResponse<Appointment> | Appointment[]>;
  findAllGlobal(startDate: Date, endDate: Date): Promise<Appointment[]>;
  findById(id: string, clinicId: string, transaction?: ITransaction): Promise<Appointment | null>;
  findByDoctorAndDate(doctorId: string, clinicId: string, date: string, transaction?: ITransaction): Promise<Appointment[]>;
  findByDoctorAndDates(doctorId: string, clinicId: string, dates: string[]): Promise<Appointment[]>;
  findByDoctorAndDateRange(doctorId: string, clinicId: string, startDate: string, endDate: string): Promise<Appointment[]>;
  findByClinicAndDate(clinicId: string, date: string): Promise<Appointment[]>;
  findPaginatedByClinicAndDate(clinicId: string, date: string, params: PaginationParams): Promise<PaginatedResponse<Appointment>>;
  findByClinicId(clinicId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]>;
  findLatestByPatientAndClinic(patientId: string, clinicId: string): Promise<Appointment | null>;
  findAllByPatientAndClinic(patientId: string, clinicId: string): Promise<Appointment[]>;
  findLatestByPatientIds(patientIds: string[], clinicId: string): Promise<Map<string, Appointment>>;
  findByPatientId(patientId: string, clinicId: string): Promise<Appointment[]>;
  findByPatientIds(patientIds: string[], clinicId: string): Promise<Appointment[]>;
  save(appointment: Appointment, clinicId: string, transaction?: ITransaction): Promise<void>;
  update(id: string, clinicId: string, data: Partial<Appointment>, transaction?: ITransaction): Promise<void>;
  incrementTokenCounter(clinicId: string, counterId: string, isClassic: boolean, transaction?: ITransaction): Promise<number>;
  peekTokenCounter(clinicId: string, counterId: string): Promise<number>;
  countByStatus(clinicId: string, status: string, start?: Date, end?: Date): Promise<number>;
  countByPharmacyStatus(clinicId: string, status: string, start?: Date, end?: Date): Promise<number>;
  countByClinicAndDateRange(clinicId: string, startDate: Date, endDate: Date): Promise<number>;
  countTotalByClinic(clinicId: string): Promise<number>;
  findCompletedByClinic(clinicId: string, filters: { doctorId?: string; pharmacyStatus?: string; startDate?: Date; endDate?: Date; limit?: number; patientPhone?: string }): Promise<Appointment[]>;
  findCompletedByPatientInClinic(patientId: string, clinicId: string): Promise<Appointment[]>;
  delete(id: string, clinicId: string, transaction?: ITransaction): Promise<void>;
  countAll(clinicId: string): Promise<number>;
  countByClinicId(clinicId: string): Promise<number>;
  countByDoctorAndDateRange(clinicId: string, doctorId: string, start: Date, end: Date): Promise<number>;

  // Transaction & Locking
  runTransaction<T>(action: (transaction: ITransaction) => Promise<T>): Promise<T>;
  createSlotLock(lockId: string, data: { appointmentId: string; doctorId: string; date: string; sessionIndex: number; slotIndex: number }, transaction: ITransaction): Promise<void>;
  releaseSlotLock(lockId: string, transaction?: ITransaction): Promise<void>;

  /**
   * Atomically increments or decrements the session's booked-count counter.
   * Must be called within the SAME transaction as the appointment write/update.
   *
   * @param delta  +1 for new bookings (including Force Book), -1 for Cancel/Skip/No-show.
   */
  updateBookedCount(clinicId: string, doctorId: string, date: string, sessionIndex: number, delta: 1 | -1, transaction: ITransaction): Promise<void>;
  findByIdGlobal(id: string, transaction?: ITransaction): Promise<Appointment | null>;
}

export interface IDoctorRepository {
  findAll(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Doctor> | Doctor[]>;
  findById(id: string, clinicId: string, transaction?: ITransaction): Promise<Doctor | null>;
  findByIds(ids: string[], clinicId: string, transaction?: ITransaction): Promise<Doctor[]>;
  findByName(clinicId: string, name: string, transaction?: ITransaction): Promise<Doctor | null>;
  findByClinicId(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Doctor> | Doctor[]>;
  findByEmail(email: string, clinicId: string, transaction?: ITransaction): Promise<Doctor | null>;
  findByUserId(userId: string, clinicId: string, transaction?: ITransaction): Promise<Doctor | null>;
  update(id: string, clinicId: string, data: Partial<Doctor>, transaction?: ITransaction): Promise<void>;
  save(doctor: Doctor, clinicId: string, transaction?: ITransaction): Promise<void>;
  saveOverride(doctorId: string, clinicId: string, dateStr: string, override: DoctorOverride, transaction?: ITransaction): Promise<void>;
  saveBreaks(doctorId: string, clinicId: string, dateStr: string, breaks: any[], transaction?: ITransaction): Promise<void>;
  saveLeave(doctorId: string, clinicId: string, dateStr: string, leave: any, transaction?: ITransaction): Promise<void>;
  delete(id: string, clinicId: string, soft?: boolean, transaction?: ITransaction): Promise<void>;
  countAll(clinicId: string): Promise<number>;
  countByClinicId(clinicId: string): Promise<number>;
  prunePastOverrides(id: string, clinicId: string, keys: string[]): Promise<void>;
  invalidateCache(id: string, clinicId?: string): void;
}

export interface IClinicRepository {
  findAll(params?: PaginationParams): Promise<PaginatedResponse<Clinic> | Clinic[]>;
  findById(id: string): Promise<Clinic | null>;
  findByIds(ids: string[]): Promise<Clinic[]>;
  update(id: string, data: Partial<Clinic>): Promise<void>;
  updateLastSyncAt(id: string, date: Date): Promise<void>;
  save(clinic: Clinic): Promise<void>;
  delete(id: string, clinicId: string, soft?: boolean, transaction?: ITransaction): Promise<void>;
  countAll(): Promise<number>;
  countByClinicId(clinicId: string): Promise<number>;
  countActive(): Promise<number>;
  incrementDoctorCount(clinicId: string, delta: 1 | -1): Promise<void>;
  upgradeSubscriptionWithTransaction(clinicId: string, newSettings: any, paymentAmount: number): Promise<void>;
}

export interface IPatientRepository {
  findAll(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Patient> | Patient[]>;
  findById(id: string, clinicId: string, transaction?: ITransaction): Promise<Patient | null>;
  findByPhone(phone: string, clinicId: string, transaction?: ITransaction): Promise<Patient[]>;
  findByCommunicationPhone(phone: string, clinicId: string, transaction?: ITransaction): Promise<Patient[]>;
  findByNameAndPhone(name: string, phone: string, clinicId: string, transaction?: ITransaction): Promise<Patient | null>;
  findByNameAndCommunicationPhone(name: string, phone: string, clinicId: string, transaction?: ITransaction): Promise<Patient | null>;
  findLinkPending(clinicId: string): Promise<Patient[]>;
  findByClinicId(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Patient> | Patient[]>;
  countAll(clinicId: string): Promise<number>;
  save(patient: Patient, clinicId: string, transaction?: ITransaction): Promise<void>;
  update(id: string, clinicId: string, patient: Partial<Patient>, transaction?: ITransaction): Promise<void>;
  delete(id: string, clinicId: string, soft?: boolean, transaction?: ITransaction): Promise<void>;
  countByClinicId(clinicId: string): Promise<number>;
  findByPatientIds(ids: string[], clinicId: string): Promise<Patient[]>;
  unlinkRelative(primaryId: string, relativeId: string, clinicId: string): Promise<void>;
  runTransaction<T>(action: (transaction: ITransaction) => Promise<T>): Promise<T>;
}

export interface IUserRepository {
  findAll(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<User> | User[]>;
  findById(id: string, clinicId: string): Promise<User | null>;
  findByPhone(phone: string, clinicId: string): Promise<User | null>;
  findByEmail(email: string, clinicId: string): Promise<User | null>;
  countByRole(clinicId: string, role: string): Promise<number>;
  save(user: User, clinicId: string, transaction?: ITransaction): Promise<void>;
  update(id: string, clinicId: string, data: Partial<User>, transaction?: ITransaction): Promise<void>;
  delete(id: string, clinicId: string, soft?: boolean, transaction?: ITransaction): Promise<void>;
  findAdminsByClinicId(clinicId: string): Promise<User[]>;
  runTransaction<T>(action: (transaction: ITransaction) => Promise<T>): Promise<T>;
}

export interface INotificationRepository {
  findAllConfigs(clinicId: string): Promise<NotificationConfig[]>;
  updateConfig(id: string, clinicId: string, data: Partial<NotificationConfig>): Promise<void>;
  resetConfigsToDefaults(clinicId: string): Promise<void>;
}

export interface IConsultationCounterRepository {
  getCount(clinicId: string, doctorId: string, date: string, sessionIndex: number): Promise<number>;
  increment(clinicId: string, doctorId: string, date: string, sessionIndex: number): Promise<void>;
}

export interface IPunctualityRepository {
  findAll(clinicId: string): Promise<PunctualityLog[]>;
  findByDoctorId(doctorId: string, clinicId: string): Promise<PunctualityLog[]>;
}

export interface IErrorLogRepository {
  findAll(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<ErrorLog> | ErrorLog[]>;
  save(errorLog: ErrorLog): Promise<void>;
}

export type AuthResponse = 
  | { status: 'success'; user: User; token: string; refreshToken?: string }
  | { status: 'requires_reset'; email: string; resetToken: string };

export interface IAuthService {
  login(email: string, password: string, appSource?: string): Promise<AuthResponse>;
  verifyToken(token: string): Promise<User>;
  createUser(email: string, password: string, role: User['role'], clinicId: string, name: string, phone?: string, accessibleMenus?: string[]): Promise<User>;
  updatePassword(uid: string, newPassword: string): Promise<void>;
  deleteUser(uid: string): Promise<void>;
  loginWithPhone(phone: string): Promise<AuthResponse>;
  refreshToken(token: string): Promise<{ token: string; refreshToken: string }>;
}

export interface GlobalSettings {
  isWhatsAppEnabled: boolean;
  updatedAt: any;
}

export interface IGlobalSettingsRepository {
  getSettings(): Promise<GlobalSettings | null>;
  updateSettings(data: Partial<GlobalSettings>): Promise<void>;
}

export interface IPrescriptionRepository {
  save(prescription: Prescription): Promise<void>;
  findById(id: string, clinicId: string): Promise<Prescription | null>;
  findByClinicId(clinicId: string): Promise<Prescription[]>;
  findByPatientId(patientId: string, clinicId: string): Promise<Prescription[]>;
  findByClinicAndDateRange(clinicId: string, startDate: Date, endDate: Date): Promise<Prescription[]>;
}

export interface IEmailService {
  sendCredentials(email: string, name: string, password: string, role: string, clinicName?: string): Promise<void>;
}

export interface IWhatsappSessionRepository {
  findByPhone(phone: string, clinicId: string): Promise<WhatsappSession | null>;
  save(session: WhatsappSession): Promise<void>;
  update(phone: string, clinicId: string, data: Partial<WhatsappSession>): Promise<void>;
}

export interface ISubscriptionRepository {
  findByClinicId(clinicId: string): Promise<Subscription | null>;
  findByRazorpaySubscriptionId(razorpaySubscriptionId: string): Promise<Subscription | null>;
  save(subscription: Omit<Subscription, 'id'>): Promise<Subscription>;
  update(id: string, clinicId: string, data: Partial<Subscription>): Promise<void>;
  getAll(): Promise<Subscription[]>;
  countByStatus(status: string): Promise<number>;
  sumMRR(): Promise<number>;
}

export interface IActivityRepository {
  save(activity: import('../../../packages/shared/src/index').ActivityLog): Promise<void>;
  findByDoctor(doctorId: string, clinicId: string, limit?: number): Promise<import('../../../packages/shared/src/index').ActivityLog[]>;
}
