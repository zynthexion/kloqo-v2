/**
 * Container.ts — Dependency Injection Container
 *
 * Centralizes the construction of every repository, service, use case,
 * and controller in the Kloqo V2 backend. This replaces the ~250-line
 * "God Block" that previously lived in index.ts.
 *
 * Architecture:
 *   Repositories → Services → Use Cases → Controllers
 *
 * Usage:
 *   import { container } from './Container';
 *   app.get('/route', container.appointmentController.method);
 */

import path from 'path';
import * as dotenv from 'dotenv';
// Use absolute path to ensure .env is found when running from monorepo root
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

// ── Infrastructure: Repositories & Services ────────────────────────────────
import { FirebaseAppointmentRepository } from '../../firebase/FirebaseAppointmentRepository';
import { FirebaseDoctorRepository } from '../../firebase/FirebaseDoctorRepository';
import { FirebaseClinicRepository } from '../../firebase/FirebaseClinicRepository';
import { FirebaseUserRepository } from '../../firebase/FirebaseUserRepository';
import { FirebasePatientRepository } from '../../firebase/FirebasePatientRepository';
import { FirebaseDepartmentRepository } from '../../firebase/FirebaseDepartmentRepository';
import { FirebaseNotificationRepository } from '../../firebase/FirebaseNotificationRepository';
import { FirebasePunctualityRepository } from '../../firebase/FirebasePunctualityRepository';
import { FirebaseErrorLogRepository } from '../../firebase/FirebaseErrorLogRepository';
import { FirebaseConsultationCounterRepository } from '../../firebase/FirebaseConsultationCounterRepository';
import { FirebaseAuthService } from '../../firebase/FirebaseAuthService';
import { FirebaseGlobalSettingsRepository } from '../../firebase/FirebaseGlobalSettingsRepository';
import { FirebasePrescriptionRepository } from '../../firebase/FirebasePrescriptionRepository';
import { FirebaseSubscriptionRepository } from '../../firebase/FirebaseSubscriptionRepository';
import { FirebaseWhatsappSessionRepository } from '../../firebase/FirebaseWhatsappSessionRepository';
import { FirebaseActivityRepository } from '../../firebase/FirebaseActivityRepository';
import { ResendEmailService } from '../../services/ResendEmailService';
import { FirebaseFCMService } from '../../services/FirebaseFCMService';
import { WhatsAppNotificationService } from '../../services/WhatsAppNotificationService';

// ── Domain Services ────────────────────────────────────────────────────────
import { SlotCalculator } from '../../../domain/services/SlotCalculator';
import { SuperadminMetricsService } from '../../../domain/services/SuperadminMetricsService';
import { NotificationService } from '../../../domain/services/NotificationService';
import { BatchNotificationService } from '../../../domain/services/BatchNotificationService';
import { TokenGeneratorService } from '../../../domain/services/token/TokenGeneratorService';
import { SSEService } from '../../../domain/services/SSEService';
import { PrescriptionPDFService } from '../../pdf/PrescriptionPDFService';
import { QueueBubblingService } from '../../../domain/services/QueueBubblingService';

// ── Application: Use Cases ─────────────────────────────────────────────────
import { ManagePatientUseCase } from '../../../application/ManagePatientUseCase';
import { BookAdvancedAppointmentUseCase } from '../../../application/BookAdvancedAppointmentUseCase';
import { GetSuperadminDashboardUseCase } from '../../../application/GetSuperadminDashboardUseCase';
import { UpdateClinicStatusUseCase } from '../../../application/UpdateClinicStatusUseCase';
import { GetDoctorDetailsUseCase } from '../../../application/GetDoctorDetailsUseCase';
import { SyncClinicStatusesUseCase } from '../../../application/SyncClinicStatusesUseCase';
import { SyncAllSubscriptionsUseCase } from '../../../application/SyncAllSubscriptionsUseCase';
import { GetNotificationConfigsUseCase } from '../../../application/GetNotificationConfigsUseCase';
import { UpdateNotificationConfigUseCase } from '../../../application/UpdateNotificationConfigUseCase';
import { ResetNotificationConfigsUseCase } from '../../../application/ResetNotificationConfigsUseCase';
import { ProcessBatchNotificationsUseCase } from '../../../application/ProcessBatchNotificationsUseCase';
import { SendBookingLinkUseCase } from '../../../application/SendBookingLinkUseCase';
import { GetLinkPendingPatientsUseCase } from '../../../application/GetLinkPendingPatientsUseCase';
import { GetPunctualityLogsUseCase } from '../../../application/GetPunctualityLogsUseCase';
import { GetErrorLogsUseCase } from '../../../application/GetErrorLogsUseCase';
import { LogErrorUseCase } from '../../../application/LogErrorUseCase';
import { GetAllClinicsUseCase } from '../../../application/GetAllClinicsUseCase';
import { GetPublicDiscoveryUseCase } from '../../../application/GetPublicDiscoveryUseCase';
import { GetAllDoctorsUseCase } from '../../../application/GetAllDoctorsUseCase';
import { GetAllPatientsUseCase } from '../../../application/GetAllPatientsUseCase';
import { GetAllDepartmentsUseCase } from '../../../application/GetAllDepartmentsUseCase';
import { GetAllAppointmentsUseCase } from '../../../application/GetAllAppointmentsUseCase';
import { GetAllUsersUseCase } from '../../../application/GetAllUsersUseCase';
import { GetClinicByIdUseCase } from '../../../application/GetClinicByIdUseCase';
import { SaveClinicUseCase } from '../../../application/SaveClinicUseCase';
import { UpdateClinicUseCase } from '../../../application/UpdateClinicUseCase';
import { DeleteClinicUseCase } from '../../../application/DeleteClinicUseCase';
import { SaveDoctorUseCase } from '../../../application/SaveDoctorUseCase';
import { DeleteDoctorUseCase } from '../../../application/DeleteDoctorUseCase';
import { SaveDepartmentUseCase } from '../../../application/SaveDepartmentUseCase';
import { UpdateDepartmentUseCase } from '../../../application/UpdateDepartmentUseCase';
import { DeleteDepartmentUseCase } from '../../../application/DeleteDepartmentUseCase';
import { LoginUseCase } from '../../../application/LoginUseCase';
import { VerifySessionUseCase } from '../../../application/VerifySessionUseCase';
import { RegisterClinicUseCase } from '../../../application/RegisterClinicUseCase';
import { CreateUserUseCase } from '../../../application/CreateUserUseCase';
import { DeleteUserUseCase } from '../../../application/DeleteUserUseCase';
import { UpdateUserUseCase } from '../../../application/UpdateUserUseCase';
import { ChangePasswordUseCase } from '../../../application/ChangePasswordUseCase';
import { GetNurseDashboardUseCase } from '../../../application/GetNurseDashboardUseCase';
import { UpdateAppointmentStatusUseCase } from '../../../application/UpdateAppointmentStatusUseCase';
import { UpdateDoctorStatusUseCase } from '../../../application/UpdateDoctorStatusUseCase';
import { ScheduleBreakUseCase } from '../../../application/ScheduleBreakUseCase';
import { CancelBreakUseCase } from '../../../application/CancelBreakUseCase';
import { UpdateDoctorLeaveUseCase } from '../../../application/UpdateDoctorLeaveUseCase';
import { MarkDoctorLeaveUseCase } from '../../../application/MarkDoctorLeaveUseCase';
import { UpdateClinicSettingsUseCase } from '../../../application/UpdateClinicSettingsUseCase';
import { UpdateDoctorAvailabilityUseCase } from '../../../application/UpdateDoctorAvailabilityUseCase';
import { UpdateWhatsappConfigUseCase } from '../../../application/UpdateWhatsappConfigUseCase';
import { GenerateShortCodeUseCase } from '../../../application/GenerateShortCodeUseCase';
import { SearchPatientsByPhoneUseCase } from '../../../application/SearchPatientsByPhoneUseCase';
import { GetPatientByIdUseCase } from '../../../application/GetPatientByIdUseCase';
import { AddRelativeUseCase } from '../../../application/AddRelativeUseCase';
import { GetDoctorActivitiesUseCase } from '../../../application/GetDoctorActivitiesUseCase';
import { EditBreakUseCase } from '../../../application/EditBreakUseCase';
import { ConfirmAppointmentPaymentUseCase } from '../../../application/ConfirmAppointmentPaymentUseCase';
import { CheckUserByEmailUseCase } from '../../../application/CheckUserByEmailUseCase';
import { GetAvailableSlotsUseCase } from '../../../application/GetAvailableSlotsUseCase';
import { GetClinicDashboardUseCase } from '../../../application/GetClinicDashboardUseCase';
import { GetProviderPerformanceUseCase } from '../../../application/GetProviderPerformanceUseCase';
import { CreatePrescriptionUseCase } from '../../../application/CreatePrescriptionUseCase';
import { GetPrescriptionsUseCase } from '../../../application/GetPrescriptionsUseCase';
import { CompleteAppointmentWithPrescriptionUseCase } from '../../../application/CompleteAppointmentWithPrescriptionUseCase';
import { DeleteAppointmentUseCase } from '../../../application/DeleteAppointmentUseCase';
import { GetWalkInEstimateUseCase } from '../../../application/GetWalkInEstimateUseCase';
import { GetWalkInPreviewUseCase } from '../../../application/GetWalkInPreviewUseCase';
import { ConfirmArrivalUseCase } from '../../../application/ConfirmArrivalUseCase';
import { FilterAppointmentsByTenantUseCase } from '../../../application/FilterAppointmentsByTenantUseCase';
import { GetPublicQueueStatusUseCase } from '../../../application/GetPublicQueueStatusUseCase';
import { CreateWalkInAppointmentUseCase } from '../../../application/CreateWalkInAppointmentUseCase';
import { GetPatientsByClinicUseCase } from '../../../application/GetPatientsByClinicUseCase';
import { GetPatientHistoryUseCase } from '../../../application/GetPatientHistoryUseCase';
import { GetPatientAppointmentsUseCase } from '../../../application/GetPatientAppointmentsUseCase';
import { SyncPatientAuthUseCase } from '../../../application/SyncPatientAuthUseCase';
import { UnlinkRelativeUseCase } from '../../../application/UnlinkRelativeUseCase';
import { UpdateDoctorAccessUseCase } from '../../../application/UpdateDoctorAccessUseCase';
import { RevokeDoctorAccessUseCase } from '../../../application/RevokeDoctorAccessUseCase';
import { GetGlobalSettingsUseCase, UpdateGlobalSettingsUseCase } from '../../../application/GlobalSettingsUseCases';
import { RegisterInitialSuperAdminUseCase } from '../../../application/RegisterInitialSuperAdminUseCase';
import { InviteSuperAdminStaffUseCase } from '../../../application/InviteSuperAdminStaffUseCase';
import { ForcePasswordResetUseCase } from '../../../application/ForcePasswordResetUseCase';
import { VerifySubscriptionUpgradeUseCase } from '../../../application/VerifySubscriptionUpgradeUseCase';
import { ImpersonateClinicUseCase } from '../../../application/ImpersonateClinicUseCase';
import { GetInvestorMetricsUseCase } from '../../../application/GetInvestorMetricsUseCase';
import { ProcessGracePeriodsUseCase } from '../../../application/ProcessGracePeriodsUseCase';
import { EndSessionCleanupUseCase } from '../../../application/EndSessionCleanupUseCase';

// ── Interfaces: Controllers ────────────────────────────────────────────────
import { AppointmentController } from '../../../interfaces/AppointmentController';
import { AuthController } from '../../../interfaces/AuthController';
import { ClinicController } from '../../../interfaces/ClinicController';
import { DoctorController } from '../../../interfaces/DoctorController';
import { PatientController } from '../../../interfaces/PatientController';
import { AnalyticsController } from '../../../interfaces/AnalyticsController';
import { UserController } from '../../../interfaces/UserController';
import { DepartmentController } from '../../../interfaces/DepartmentController';
import { NotificationController } from '../../../interfaces/NotificationController';
import { PrescriptionController } from '../../../interfaces/PrescriptionController';
import { PaymentController } from '../../../interfaces/PaymentController';
import { StorageController } from '../../../interfaces/StorageController';
import { SSEController } from '../../../interfaces/SSEController';
import { WebhookController } from '../../../interfaces/WebhookController';
import { WhatsAppWebhookController } from '../../../interfaces/http/controllers/WhatsAppWebhookController';
import { SettingsController } from '../../../interfaces/SettingsController';
import { SuperAdminController } from '../../../interfaces/SuperAdminController';
import { PublicBookingController } from '../../../interfaces/PublicBookingController';

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1: Repositories & Infrastructure Services
// ═══════════════════════════════════════════════════════════════════════════
const appointmentRepo = new FirebaseAppointmentRepository();
const doctorRepo = new FirebaseDoctorRepository();
const clinicRepo = new FirebaseClinicRepository();
const userRepo = new FirebaseUserRepository();
const patientRepo = new FirebasePatientRepository();
const departmentRepo = new FirebaseDepartmentRepository();
const notificationRepo = new FirebaseNotificationRepository();
const punctualityRepo = new FirebasePunctualityRepository();
const errorLogRepo = new FirebaseErrorLogRepository();
const counterRepo = new FirebaseConsultationCounterRepository();
const globalSettingsRepo = new FirebaseGlobalSettingsRepository();
const prescriptionRepo = new FirebasePrescriptionRepository();
const subscriptionRepo = new FirebaseSubscriptionRepository();
const whatsappSessionRepo = new FirebaseWhatsappSessionRepository();
const activityRepo = new FirebaseActivityRepository();

const authService = new FirebaseAuthService(userRepo, clinicRepo, patientRepo);
const emailService = new ResendEmailService(process.env.RESEND_API_KEY || '');
const fcmService = new FirebaseFCMService(userRepo);
const whatsappService = new WhatsAppNotificationService();
const pdfService = new PrescriptionPDFService();

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2: Domain Services
// ═══════════════════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _slotCalculator = new SlotCalculator();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _superadminMetricsService = new SuperadminMetricsService();

const notificationService = new NotificationService(
  appointmentRepo, clinicRepo, doctorRepo, notificationRepo, globalSettingsRepo, userRepo, fcmService, whatsappService, whatsappSessionRepo
);
const syncAllSubscriptionsUseCase = new SyncAllSubscriptionsUseCase();
const batchNotificationService = new BatchNotificationService(
  appointmentRepo, doctorRepo, clinicRepo, notificationRepo, notificationService, syncAllSubscriptionsUseCase
);
const tokenGeneratorService = new TokenGeneratorService(appointmentRepo);
const sseService = new SSEService();
const queueBubblingService = new QueueBubblingService(appointmentRepo, doctorRepo);

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3: Use Cases
// ═══════════════════════════════════════════════════════════════════════════

// Auth
const verifySessionUseCase = new VerifySessionUseCase(authService);
const loginUseCase = new LoginUseCase(authService);
const registerClinicUseCase = new RegisterClinicUseCase(emailService);
const updateUserUseCase = new UpdateUserUseCase(userRepo);
const changePasswordUseCase = new ChangePasswordUseCase(authService);
const checkUserByEmailUseCase = new CheckUserByEmailUseCase(userRepo);
const getAllUsersUseCase = new GetAllUsersUseCase(userRepo);
const createUserUseCase = new CreateUserUseCase(userRepo, emailService, clinicRepo);
const deleteUserUseCase = new DeleteUserUseCase(userRepo);
const registerInitialSuperAdminUseCase = new RegisterInitialSuperAdminUseCase(authService, userRepo);
const inviteSuperAdminStaffUseCase = new InviteSuperAdminStaffUseCase(authService, userRepo, emailService);
const forcePasswordResetUseCase = new ForcePasswordResetUseCase(authService, userRepo);
const impersonateClinicUseCase = new ImpersonateClinicUseCase(clinicRepo);

// Patients
const managePatientUseCase = new ManagePatientUseCase(patientRepo);
const searchPatientsByPhoneUseCase = new SearchPatientsByPhoneUseCase(patientRepo);
const getPatientByIdUseCase = new GetPatientByIdUseCase(patientRepo);
const addRelativeUseCase = new AddRelativeUseCase(patientRepo, userRepo);
const getLinkPendingPatientsUseCase = new GetLinkPendingPatientsUseCase(patientRepo);
const getPatientsByClinicUseCase = new GetPatientsByClinicUseCase(patientRepo, appointmentRepo);
const getPatientHistoryUseCase = new GetPatientHistoryUseCase(patientRepo, appointmentRepo);
const getPatientAppointmentsUseCase = new GetPatientAppointmentsUseCase(appointmentRepo);
const getAllPatientsUseCase = new GetAllPatientsUseCase(patientRepo);
const syncPatientAuthUseCase = new SyncPatientAuthUseCase(userRepo, patientRepo);
const unlinkRelativeUseCase = new UnlinkRelativeUseCase(patientRepo);
const getPublicDiscoveryUseCase = new GetPublicDiscoveryUseCase(clinicRepo, doctorRepo);

// Clinics
const getAllClinicsUseCase = new GetAllClinicsUseCase(clinicRepo);
const getClinicByIdUseCase = new GetClinicByIdUseCase(clinicRepo);
const saveClinicUseCase = new SaveClinicUseCase(clinicRepo);
const updateClinicUseCase = new UpdateClinicUseCase(clinicRepo);
const deleteClinicUseCase = new DeleteClinicUseCase(clinicRepo);
const updateClinicStatusUseCase = new UpdateClinicStatusUseCase(clinicRepo);
const updateClinicSettingsUseCase = new UpdateClinicSettingsUseCase(clinicRepo);
const updateWhatsappConfigUseCase = new UpdateWhatsappConfigUseCase(clinicRepo);
const generateShortCodeUseCase = new GenerateShortCodeUseCase(clinicRepo);
const syncClinicStatusesUseCase = new SyncClinicStatusesUseCase(doctorRepo, clinicRepo, appointmentRepo);
const verifySubscriptionUpgradeUseCase = new VerifySubscriptionUpgradeUseCase(clinicRepo);

// Doctors & Departments
const getAllDoctorsUseCase = new GetAllDoctorsUseCase(doctorRepo, userRepo);
const getDoctorDetailsUseCase = new GetDoctorDetailsUseCase(doctorRepo, clinicRepo, departmentRepo, appointmentRepo, userRepo);
const saveDoctorUseCase = new SaveDoctorUseCase(doctorRepo, userRepo, authService, emailService, clinicRepo);
const deleteDoctorUseCase = new DeleteDoctorUseCase(doctorRepo, clinicRepo);
const updateDoctorStatusUseCase = new UpdateDoctorStatusUseCase(doctorRepo, appointmentRepo, clinicRepo, notificationService);
const updateDoctorAvailabilityUseCase = new UpdateDoctorAvailabilityUseCase(doctorRepo, appointmentRepo, activityRepo, notificationService);
const updateDoctorLeaveUseCase = new UpdateDoctorLeaveUseCase(appointmentRepo, doctorRepo, activityRepo);
const markDoctorLeaveUseCase = new MarkDoctorLeaveUseCase(doctorRepo, appointmentRepo, notificationService, activityRepo);
const scheduleBreakUseCase = new ScheduleBreakUseCase(appointmentRepo, doctorRepo, clinicRepo, activityRepo);
const cancelBreakUseCase = new CancelBreakUseCase(appointmentRepo, doctorRepo, clinicRepo, activityRepo);
const getDoctorActivitiesUseCase = new GetDoctorActivitiesUseCase(activityRepo);
const editBreakUseCase = new EditBreakUseCase(appointmentRepo, doctorRepo, clinicRepo, activityRepo);
const updateDoctorAccessUseCase = new UpdateDoctorAccessUseCase(doctorRepo, userRepo);
const revokeDoctorAccessUseCase = new RevokeDoctorAccessUseCase(doctorRepo, userRepo, authService);
const getAllDepartmentsUseCase = new GetAllDepartmentsUseCase(departmentRepo);
const saveDepartmentUseCase = new SaveDepartmentUseCase(departmentRepo);
const updateDepartmentUseCase = new UpdateDepartmentUseCase(departmentRepo);
const deleteDepartmentUseCase = new DeleteDepartmentUseCase(departmentRepo);

// Appointments
const getAllAppointmentsUseCase = new GetAllAppointmentsUseCase(appointmentRepo);
const getNurseDashboardUseCase = new GetNurseDashboardUseCase(clinicRepo, doctorRepo, appointmentRepo, syncClinicStatusesUseCase);
const updateAppointmentStatusUseCase = new UpdateAppointmentStatusUseCase(appointmentRepo, doctorRepo, clinicRepo, notificationService, counterRepo, tokenGeneratorService, queueBubblingService);
const createWalkInAppointmentUseCase = new CreateWalkInAppointmentUseCase(appointmentRepo, doctorRepo, clinicRepo, managePatientUseCase, tokenGeneratorService);
const bookAdvancedAppointmentUseCase = new BookAdvancedAppointmentUseCase(appointmentRepo, doctorRepo, patientRepo, clinicRepo, managePatientUseCase, tokenGeneratorService);
const getAvailableSlotsUseCase = new GetAvailableSlotsUseCase(appointmentRepo, doctorRepo, clinicRepo);
const deleteAppointmentUseCase = new DeleteAppointmentUseCase(appointmentRepo);
const sendBookingLinkUseCase = new SendBookingLinkUseCase(notificationService, clinicRepo, patientRepo, userRepo);
const getWalkInEstimateUseCase = new GetWalkInEstimateUseCase(appointmentRepo, doctorRepo, clinicRepo, tokenGeneratorService);
const getWalkInPreviewUseCase = new GetWalkInPreviewUseCase(appointmentRepo, doctorRepo, clinicRepo, tokenGeneratorService);
const confirmArrivalUseCase = new ConfirmArrivalUseCase(appointmentRepo, clinicRepo, updateAppointmentStatusUseCase);
const getPublicQueueStatusUseCase = new GetPublicQueueStatusUseCase(clinicRepo, doctorRepo, appointmentRepo);
const confirmAppointmentPaymentUseCase = new ConfirmAppointmentPaymentUseCase(appointmentRepo, sseService);

// Prescriptions
const createPrescriptionUseCase = new CreatePrescriptionUseCase(prescriptionRepo);
const getPrescriptionsUseCase = new GetPrescriptionsUseCase(prescriptionRepo);
const completeAppointmentWithPrescriptionUseCase = new CompleteAppointmentWithPrescriptionUseCase(
  appointmentRepo, 
  clinicRepo, 
  doctorRepo,
  counterRepo, 
  notificationService,
  pdfService
);

// Analytics & Notifications
const getSuperadminDashboardUseCase = new GetSuperadminDashboardUseCase(clinicRepo, userRepo, patientRepo, appointmentRepo);
const getPunctualityLogsUseCase = new GetPunctualityLogsUseCase(punctualityRepo);
const getErrorLogsUseCase = new GetErrorLogsUseCase(errorLogRepo);
const logErrorUseCase = new LogErrorUseCase(errorLogRepo);
const getClinicDashboardUseCase = new GetClinicDashboardUseCase(clinicRepo, appointmentRepo, doctorRepo, patientRepo, prescriptionRepo);
const getProviderPerformanceUseCase = new GetProviderPerformanceUseCase(doctorRepo, appointmentRepo);
const getNotificationConfigsUseCase = new GetNotificationConfigsUseCase(notificationRepo);
const updateNotificationConfigUseCase = new UpdateNotificationConfigUseCase(notificationRepo);
const resetNotificationConfigsUseCase = new ResetNotificationConfigsUseCase(notificationRepo);
const processBatchNotificationsUseCase = new ProcessBatchNotificationsUseCase(batchNotificationService);
const getInvestorMetricsUseCase = new GetInvestorMetricsUseCase(subscriptionRepo, appointmentRepo);
const processGracePeriodsUseCase = new ProcessGracePeriodsUseCase(appointmentRepo, clinicRepo, doctorRepo, queueBubblingService);
const endSessionCleanupUseCase = new EndSessionCleanupUseCase(appointmentRepo, doctorRepo);

// Settings
const getGlobalSettingsUseCase = new GetGlobalSettingsUseCase(globalSettingsRepo);
const updateGlobalSettingsUseCase = new UpdateGlobalSettingsUseCase(globalSettingsRepo);

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 4: Controllers
// ═══════════════════════════════════════════════════════════════════════════
const filterAppointmentsByTenantUseCase = new FilterAppointmentsByTenantUseCase(appointmentRepo, doctorRepo);

const appointmentController = new AppointmentController(
  getAllAppointmentsUseCase,
  getNurseDashboardUseCase,
  updateAppointmentStatusUseCase,
  createWalkInAppointmentUseCase,
  bookAdvancedAppointmentUseCase,
  getAvailableSlotsUseCase,
  deleteAppointmentUseCase,
  sendBookingLinkUseCase,
  getWalkInEstimateUseCase,
  getWalkInPreviewUseCase,
  confirmArrivalUseCase,
  filterAppointmentsByTenantUseCase,
  appointmentRepo,
  doctorRepo
);

const authController = new AuthController(
  loginUseCase,
  verifySessionUseCase,
  registerClinicUseCase,
  updateUserUseCase,
  changePasswordUseCase,
  checkUserByEmailUseCase,
  authService,
  forcePasswordResetUseCase
);

const clinicController = new ClinicController(
  getAllClinicsUseCase,
  getClinicByIdUseCase,
  saveClinicUseCase,
  updateClinicUseCase,
  deleteClinicUseCase,
  updateClinicStatusUseCase,
  updateClinicSettingsUseCase,
  updateWhatsappConfigUseCase,
  generateShortCodeUseCase,
  syncClinicStatusesUseCase
);

const doctorController = new DoctorController(
  getAllDoctorsUseCase,
  getDoctorDetailsUseCase,
  saveDoctorUseCase,
  deleteDoctorUseCase,
  updateDoctorStatusUseCase,
  updateDoctorAvailabilityUseCase,
  updateDoctorLeaveUseCase,
  scheduleBreakUseCase,
  cancelBreakUseCase,
  markDoctorLeaveUseCase,
  updateDoctorAccessUseCase,
  revokeDoctorAccessUseCase,
  getAvailableSlotsUseCase,
  getDoctorActivitiesUseCase,
  editBreakUseCase
);

const patientController = new PatientController(
  getAllPatientsUseCase,
  searchPatientsByPhoneUseCase,
  getPatientByIdUseCase,
  managePatientUseCase,
  addRelativeUseCase,
  getLinkPendingPatientsUseCase,
  getPatientsByClinicUseCase,
  getPatientHistoryUseCase,
  getPatientAppointmentsUseCase,
  syncPatientAuthUseCase,
  unlinkRelativeUseCase
);

const analyticsController = new AnalyticsController(
  getSuperadminDashboardUseCase,
  getPunctualityLogsUseCase,
  getErrorLogsUseCase,
  getClinicDashboardUseCase,
  getProviderPerformanceUseCase,
  logErrorUseCase,
  getInvestorMetricsUseCase
);

const userController = new UserController(
  getAllUsersUseCase,
  createUserUseCase,
  deleteUserUseCase,
  updateUserUseCase,
  inviteSuperAdminStaffUseCase,
  registerInitialSuperAdminUseCase
);

const departmentController = new DepartmentController(
  getAllDepartmentsUseCase,
  saveDepartmentUseCase,
  updateDepartmentUseCase,
  deleteDepartmentUseCase
);

const notificationController = new NotificationController(
  getNotificationConfigsUseCase,
  updateNotificationConfigUseCase,
  resetNotificationConfigsUseCase,
  processBatchNotificationsUseCase,
  sendBookingLinkUseCase
);

const prescriptionController = new PrescriptionController(
  completeAppointmentWithPrescriptionUseCase,
  appointmentRepo,
  subscriptionRepo
);

const settingsController = new SettingsController(
  getGlobalSettingsUseCase,
  updateGlobalSettingsUseCase
);

const webhookController = new WebhookController(subscriptionRepo, clinicRepo);
const whatsappWebhookController = new WhatsAppWebhookController(appointmentRepo, updateAppointmentStatusUseCase, notificationService);
const paymentController = new PaymentController(confirmAppointmentPaymentUseCase, verifySubscriptionUpgradeUseCase);
const storageController = new StorageController();
const sseController = new SSEController();
const superAdminController = new SuperAdminController(impersonateClinicUseCase);
const publicBookingController = new PublicBookingController(
  getAllDoctorsUseCase,
  getClinicByIdUseCase,
  getAvailableSlotsUseCase,
  getDoctorDetailsUseCase,
  getPublicQueueStatusUseCase,
  appointmentRepo,
  clinicRepo
);

// ═══════════════════════════════════════════════════════════════════════════
// Exports — the route files import exactly what they need
// ═══════════════════════════════════════════════════════════════════════════
export const container = {
  // Controllers
  appointmentController,
  authController,
  clinicController,
  doctorController,
  patientController,
  analyticsController,
  userController,
  departmentController,
  notificationController,
  prescriptionController,
  settingsController,
  webhookController,
  whatsappWebhookController,
  paymentController,
  storageController,
  sseController,
  superAdminController,
  publicBookingController,

  // Exposed for middleware factory and inline route handlers
  verifySessionUseCase,
  fcmService,
  subscriptionRepo,
  appointmentRepo,
  clinicRepo,
  getPublicQueueStatusUseCase,
  processGracePeriodsUseCase,
  endSessionCleanupUseCase,
};
