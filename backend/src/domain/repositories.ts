import { Clinic, User, Patient, Appointment, TrafficData, Department, Doctor, CampaignSend, MarketingAnalytics, MarketingInteraction, WhatsappSession, NotificationConfig, PunctualityLog, ErrorLog, PaginationParams, PaginatedResponse, Prescription } from '../../../packages/shared/src/index';

export interface IDBTransaction {}

export type { WhatsappSession };

export interface IDepartmentRepository {
  findAll(params?: PaginationParams): Promise<PaginatedResponse<Department> | Department[]>;
  findById(id: string): Promise<Department | null>;
  save(department: Department): Promise<void>;
  update(id: string, department: Partial<Department>): Promise<void>;
  delete(id: string, soft?: boolean): Promise<void>;
}

export interface IAppointmentRepository {
  findAll(params?: PaginationParams): Promise<PaginatedResponse<Appointment> | Appointment[]>;
  findById(id: string): Promise<Appointment | null>;
  findByDoctorAndDate(doctorId: string, date: string): Promise<Appointment[]>;
  findByClinicAndDate(clinicId: string, date: string): Promise<Appointment[]>;
  findByClinicId(clinicId: string, startDate?: Date, endDate?: Date): Promise<Appointment[]>;
  findLatestByPatientAndClinic(patientId: string, clinicId: string): Promise<Appointment | null>;
  findAllByPatientAndClinic(patientId: string, clinicId: string): Promise<Appointment[]>;
  findLatestByPatientIds(patientIds: string[], clinicId: string): Promise<Map<string, Appointment>>;
  findByPatientId(patientId: string): Promise<Appointment[]>;
  save(appointment: Appointment, transaction?: IDBTransaction): Promise<void>;
  update(id: string, data: Partial<Appointment>, transaction?: IDBTransaction): Promise<void>;
  incrementTokenCounter(counterId: string, isClassic: boolean, transaction?: IDBTransaction): Promise<number>;
  countByStatus(clinicId: string, status: string, start?: Date, end?: Date): Promise<number>;
  countByPharmacyStatus(clinicId: string, status: string, start?: Date, end?: Date): Promise<number>;
  findCompletedByClinic(clinicId: string, filters: { doctorId?: string; pharmacyStatus?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<Appointment[]>;
  findCompletedByPatientInClinic(patientId: string, clinicId: string): Promise<Appointment[]>;
  delete(id: string): Promise<void>;
  
  // Transaction & Locking
  runTransaction<T>(action: (transaction: IDBTransaction) => Promise<T>): Promise<T>;
  createSlotLock(lockId: string, data: { appointmentId: string; doctorId: string; date: string; sessionIndex: number; slotIndex: number }, transaction: IDBTransaction): Promise<void>;
  releaseSlotLock(lockId: string, transaction?: IDBTransaction): Promise<void>;
}

export interface IDoctorRepository {
  findAll(params?: PaginationParams): Promise<PaginatedResponse<Doctor> | Doctor[]>;
  findById(id: string): Promise<Doctor | null>;
  findByIds(ids: string[]): Promise<Doctor[]>;
  findByName(clinicId: string, name: string): Promise<Doctor | null>;
  findByClinicId(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Doctor> | Doctor[]>;
  findByEmail(email: string): Promise<Doctor | null>;
  findByUserId(userId: string, email?: string): Promise<Doctor | null>;
  update(id: string, data: Partial<Doctor>): Promise<void>;
  save(doctor: Doctor): Promise<void>;
  delete(id: string, soft?: boolean): Promise<void>;
}

export interface IClinicRepository {
  findAll(params?: PaginationParams): Promise<PaginatedResponse<Clinic> | Clinic[]>;
  findById(id: string): Promise<Clinic | null>;
  update(id: string, data: Partial<Clinic>): Promise<void>;
  updateLastSyncAt(id: string, date: Date): Promise<void>;
  save(clinic: Clinic): Promise<void>;
  delete(id: string, soft?: boolean): Promise<void>;
  countActive(): Promise<number>;
  incrementDoctorCount(clinicId: string, delta: 1 | -1): Promise<void>;
  upgradeSubscriptionWithTransaction(clinicId: string, newSettings: any, paymentAmount: number): Promise<void>;
}

export interface IPatientRepository {
  findAll(params?: PaginationParams): Promise<PaginatedResponse<Patient> | Patient[]>;
  findById(id: string): Promise<Patient | null>;
  findByPhone(phone: string): Promise<Patient[]>;
  findByPhoneAndClinic(phone: string, clinicId: string): Promise<Patient[]>;
  findByCommunicationPhone(phone: string): Promise<Patient[]>;
  findByCommunicationPhoneAndClinic(phone: string, clinicId: string): Promise<Patient[]>;
  findLinkPending(clinicId: string): Promise<Patient[]>;
  findByClinicId(clinicId: string, params?: PaginationParams): Promise<PaginatedResponse<Patient> | Patient[]>;
  countAll(): Promise<number>;
  save(patient: Patient, transaction?: IDBTransaction): Promise<void>;
  update(id: string, patient: Partial<Patient>, transaction?: IDBTransaction): Promise<void>;
  delete(id: string, soft?: boolean): Promise<void>;
  unlinkRelative(primaryId: string, relativeId: string): Promise<void>;
}

export interface IUserRepository {
  findAll(params?: PaginationParams): Promise<PaginatedResponse<User> | User[]>;
  findById(id: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  countByRole(role: string): Promise<number>;
  save(user: User): Promise<void>;
  update(id: string, data: Partial<User>): Promise<void>;
  delete(id: string, soft?: boolean): Promise<void>;
  findAdminsByClinicId(clinicId: string): Promise<User[]>;
}

export interface INotificationRepository {
  findAllConfigs(): Promise<NotificationConfig[]>;
  updateConfig(id: string, data: Partial<NotificationConfig>): Promise<void>;
  resetConfigsToDefaults(): Promise<void>;
}

export interface IConsultationCounterRepository {
  getCount(clinicId: string, doctorId: string, date: string, sessionIndex: number): Promise<number>;
  increment(clinicId: string, doctorId: string, date: string, sessionIndex: number): Promise<void>;
}

export interface IPunctualityRepository {
  findAll(): Promise<PunctualityLog[]>;
  findByDoctorId(doctorId: string): Promise<PunctualityLog[]>;
}

export interface IErrorLogRepository {
  findAll(params?: PaginationParams): Promise<PaginatedResponse<ErrorLog> | ErrorLog[]>;
  save(errorLog: ErrorLog): Promise<void>;
}

export type AuthResponse = 
  | { status: 'success'; user: User; token: string }
  | { status: 'requires_reset'; email: string; resetToken: string };

export interface IAuthService {
  login(email: string, password: string, appSource?: string): Promise<AuthResponse>;
  verifyToken(token: string): Promise<User>;
  createUser(email: string, password: string, role: User['role'], clinicId: string, name: string, phone?: string, accessibleMenus?: string[]): Promise<User>;
  updatePassword(uid: string, newPassword: string): Promise<void>;
  deleteUser(uid: string): Promise<void>;
  loginWithPhone(phone: string): Promise<AuthResponse>;
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
  findById(id: string): Promise<Prescription | null>;
  findByClinicId(clinicId: string): Promise<Prescription[]>;
  findByPatientId(patientId: string): Promise<Prescription[]>;
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

export interface IActivityRepository {
  save(activity: import('../../../packages/shared/src/index').ActivityLog): Promise<void>;
  findByDoctor(doctorId: string, clinicId: string, limit?: number): Promise<import('../../../packages/shared/src/index').ActivityLog[]>;
}
