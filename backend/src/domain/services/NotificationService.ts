import { Appointment, Clinic, Doctor, NOTIFICATION_TYPES } from '../../../../packages/shared/src/index';
import {
  IAppointmentRepository,
  IClinicRepository,
  IDoctorRepository,
  INotificationRepository,
  IGlobalSettingsRepository,
  IWhatsappSessionRepository,
  IUserRepository,
} from '../repositories';
import { format, addDays, differenceInHours, parse } from 'date-fns';
import { IFCMService } from '../../infrastructure/services/FirebaseFCMService';
import { IWhatsAppNotificationService } from '../../infrastructure/services/WhatsAppNotificationService';
import { getClinicNow } from './DateUtils';

const WINDOW_HOURS = 24;

// ─────────────────────────────────────────────────────────────────────────────
// GA4 Measurement Protocol — Zero-Cost Efficiency Tracking
// Fires server-side events to GA4 without any Firestore writes.
// Fails silently so analytics never crash the main appointment flow.
// ─────────────────────────────────────────────────────────────────────────────

const GA4_ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA4_MEASUREMENT_ID}&api_secret=${process.env.GA4_API_SECRET}`;

/**
 * Fires a GA4 Measurement Protocol event. Always fire-and-forget.
 * @param eventName  e.g. 'wa_reminder_sent', 'wa_reminder_confirmed'
 * @param params     Additional event parameters
 * @param clientId   Synthetic client_id — use appointmentId for server-side events
 */
function trackGA4Event(
  eventName: string,
  params: Record<string, string | number>,
  clientId: string
): void {
  if (!process.env.GA4_MEASUREMENT_ID || !process.env.GA4_API_SECRET) return;

  const payload = JSON.stringify({
    client_id: clientId,
    events: [{ name: eventName, params: { engagement_time_msec: 1, ...params } }],
  });

  fetch(GA4_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  }).catch(err => console.warn(`[GA4] Silent failure for ${eventName}:`, err));
}

// ─────────────────────────────────────────────────────────────────────────────
// Malayalam date/time utility  (Rule 8 — IST-aware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a Malayalam-friendly date+time string.
 * - Same calendar day (IST) → "ഇന്ന് 4:30 PM"
 * - Next calendar day (IST) → "നാളെ 4:30 PM"
 * - Other                   → "<original date> 4:30 PM"
 *
 * Uses Intl.DateTimeFormat to determine IST (Asia/Kolkata) wall-clock date
 * without any external timezone library (Rule 8).
 *
 * @param dateStr  "YYYY-MM-DD"
 * @param timeStr  Time string already formatted (e.g. "4:30 PM")
 */
export function getMalayalamFriendlyDateTime(dateStr: string, timeStr: string): string {
  try {
    const ist = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const now = new Date();
    const todayStr = ist.format(now);                            // "YYYY-MM-DD"
    const tomorrowStr = ist.format(new Date(now.getTime() + 86_400_000));

    const normalised = dateStr.substring(0, 10); // guard against ISO timestamps

    let prefix: string;
    if (normalised === todayStr) {
      prefix = 'ഇന്ന്';   // Today
    } else if (normalised === tomorrowStr) {
      prefix = 'നാളെ';    // Tomorrow
    } else {
      prefix = dateStr;
    }

    return `${prefix} ${timeStr}`;
  } catch {
    return `${dateStr} ${timeStr}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationService
// ─────────────────────────────────────────────────────────────────────────────

export class NotificationService {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private clinicRepo: IClinicRepository,
    private doctorRepo: IDoctorRepository,
    private notificationRepo: INotificationRepository,
    private globalSettingsRepo: IGlobalSettingsRepository,
    private userRepo: IUserRepository,
    private fcmService?: IFCMService,
    private whatsappService?: IWhatsAppNotificationService,
    private whatsappSessionRepo?: IWhatsappSessionRepository,
  ) {}

  // ───────────────────────────────────────────────────────
  // Admin Alerts
  // ───────────────────────────────────────────────────────

  /**
   * High-priority alert to clinic administrators.
   */
  async sendAdminAlert(params: { clinicId: string, title: string, body: string }): Promise<void> {
    const { clinicId, title, body } = params;
    
    try {
      const admins = await this.userRepo.findAdminsByClinicId(clinicId);
      if (admins.length === 0) return;

      await Promise.allSettled(admins.map(async admin => {
        // 1. PWA Push
        if (this.fcmService) {
          await this.fcmService.sendToUser(admin.id!, clinicId, {
            title,
            body,
            data: { type: 'admin_alert', clinicId }
          });
        }

        // 2. WhatsApp (if admin has a phone number)
        if (admin.phone) {
          await this.sendWhatsAppMessage({
            to: admin.phone,
            clinicId,
            message: `⚠️ *ADMIN ALERT*\n\n*${title}*\n\n${body}`
          });
        }
      }));
    } catch (error) {
      console.error('[NotificationService] Failed to send admin alert:', error);
    }
  }

  // ───────────────────────────────────────────────────────
  // Smart Dispatcher (Rule 14 – FinOps)
  // ───────────────────────────────────────────────────────

  /**
   * Returns 'free' when the patient has an open 24-hour window (last inbound
   * WhatsApp message was within 24 hours from this clinicId) so we can send a
   * free-form text instead of a paid template.
   *
   * NOTE: This method must NEVER be called for `sendWhatsAppReminderNotification`
   * because that alert must always use interactive button templates.
   */
  private async determineMessageType(
    patientPhone: string,
    clinicId: string,
  ): Promise<'free' | 'paid'> {
    if (!this.whatsappSessionRepo) return 'paid';

    try {
      const session = await this.whatsappSessionRepo.findByPhone(patientPhone, clinicId);
      if (!session) return 'paid';

      const lastAt =
        session.lastMessageAt instanceof Date
          ? session.lastMessageAt
          : new Date(session.lastMessageAt);

      const hoursElapsed = differenceInHours(new Date(), lastAt);
      return hoursElapsed < WINDOW_HOURS ? 'free' : 'paid';
    } catch (err) {
      console.error('[SmartDispatcher] Error checking window:', err);
      return 'paid'; // Safe default — never miss a message
    }
  }

  // ───────────────────────────────────────────────────────
  // Core Private Sender
  // ───────────────────────────────────────────────────────

  private async isWhatsAppGloballyEnabled(): Promise<boolean> {
    const settings = await this.globalSettingsRepo.getSettings();
    return !(settings && !settings.isWhatsAppEnabled);
  }

  public async sendWhatsAppMessage(params: {
    to: string;
    message?: string;
    templateName?: string;
    templateVariables?: Record<string, string>;
    mediaUrl?: string;
    clinicId?: string;
    buttonPayloads?: { index: number; payload: string }[];
  }): Promise<boolean> {
    const { to, message, templateName, templateVariables, mediaUrl, buttonPayloads } = params;

    if (!(await this.isWhatsAppGloballyEnabled())) {
      console.log(`[Global Toggle] WhatsApp DISABLED globally. Skipping message to ${to}.`);
      return false;
    }

    if (!this.whatsappService) {
      console.warn(`[NotificationService] whatsappService not injected. Message to ${to} dropped.`);
      return false;
    }

    if (templateName) {
      return await this.whatsappService.sendTemplate({
        to,
        templateName,
        templateVariables,
        mediaUrl,
        buttonPayloads,
      });
    }

    return await this.whatsappService.sendMessage(to, message ?? '');
  }

  // ───────────────────────────────────────────────────────
  // Public Methods
  // ───────────────────────────────────────────────────────

  /**
   * Appointment Reminder with Interactive Buttons.
   *
   * Constraint: ALWAYS uses sendTemplate (Paid).  We must never fall back to
   * free text here because Meta will only render Quick Reply buttons inside a
   * template message.
   *
   * Template: appointment_reminder_v2_ml
   * Variables:
   *   {{1}} Patient Name
   *   {{2}} Doctor Name
   *   {{3}} Malayalam Date+Time  (e.g. "ഇന്ന് 4:30 PM")
   *   {{4}} Token Number
   */
  async sendWhatsAppReminderNotification(params: {
    phone: string;
    patientName: string;
    doctorName: string;
    clinicName: string;
    date: string;
    time: string;
    appointmentId: string;
    tokenNumber?: string;
    clinicId: string;
  }): Promise<boolean> {
    const {
      phone, patientName, doctorName, clinicName, date, time,
      appointmentId, tokenNumber, clinicId,
    } = params;

    const malayalamDateTime = getMalayalamFriendlyDateTime(date, time);
    const displayToken = tokenNumber || 'ക്ലിനിക്കിൽ വരുമ്പോൾ ലഭിക്കും';

    console.log(`[Reminder] Sending appointment_reminder_v2_ml (PAID Template) to ${phone}.`);

    const success = await this.sendWhatsAppMessage({
      to: phone,
      clinicId,
      templateName: 'appointment_reminder_v2_ml',
      templateVariables: {
        '1': patientName,
        '2': doctorName,
        '3': malayalamDateTime,
        '4': displayToken,
      },
      buttonPayloads: [
        { index: 0, payload: `APP_CONFIRM_${appointmentId}` },
        { index: 1, payload: `APP_CANCEL_${appointmentId}` },
      ],
    });

    if (success) {
      // Fire GA4 event — zero Firestore cost (Rule 14)
      trackGA4Event('wa_reminder_sent', { clinicId, doctorName }, appointmentId);
    }

    return success;
  }

  /**
   * Token Called Alert — Smart Dispatcher routed.
   * Template: token_called_quick_reply_ml
   * Free text: "നമസ്കാരം {name}, നിങ്ങളുടെ ടോക്കൺ {token} ഇപ്പോൾ വിളിച്ചിരിക്കുന്നു. ഡോക്ടറുടെ അടുത്തേക്ക് ദയവായി വരൂ. 🩺"
   */
  async sendTokenCalledAlert(params: {
    phone: string;
    patientName: string;
    tokenNumber: string;
    clinicId: string;
    patientId?: string;
    appointmentId?: string;
  }): Promise<boolean> {
    const { phone, patientName, tokenNumber, clinicId, patientId, appointmentId } = params;

    // 1. PWA Push
    if (patientId && this.fcmService) {
      this.fcmService.sendToUser(patientId, clinicId, {
        title: 'നിങ്ങളെ വിളിക്കുന്നു (Token Called)',
        body: `ടോക്കൺ ${tokenNumber} വിളിച്ചിരിക്കുന്നു. ഡോക്ടറുടെ അടുത്തേക്ക് ദയവായി വരൂ. 🩺`,
        data: {
          appointmentId: appointmentId || '',
          type: 'token_called',
          clinicId,
        }
      }).catch(err => console.error('[FCM] Token called push failed:', err));
    }

    // 2. WhatsApp
    const msgType = await this.determineMessageType(phone, clinicId);
    console.log(`[TokenCalled] Window=${msgType} for ${phone}.`);

    if (msgType === 'free') {
      const text =
        `നമസ്കാരം ${patientName}, \n\nനിങ്ങളുടെ ടോക്കൺ ${tokenNumber} ഇപ്പോൾ വിളിച്ചിരിക്കുന്നു. ✅\n\nഡോക്ടറുടെ അടുത്തേക്ക് ദയവായി വരൂ. 🩺`;
      return this.sendWhatsAppMessage({ to: phone, clinicId, message: text });
    }

    return this.sendWhatsAppMessage({
      to: phone,
      clinicId,
      templateName: 'token_called_quick_reply_ml',
      templateVariables: { '1': patientName, '2': tokenNumber },
    });
  }

  /**
   * Doctor Running Late Alert — Smart Dispatcher routed.
   * Template: doctor_running_late_ml
   * Free text: "നമസ്കാരം {name}, ഡോക്ടർ {doctor} ഇന്ന് അൽപ്പം വൈകും. ..."
   */
  async sendDoctorRunningLateAlert(params: {
    phone: string;
    patientName: string;
    doctorName: string;
    delayMinutes: number;
    clinicId: string;
  }): Promise<boolean> {
    const { phone, patientName, doctorName, delayMinutes, clinicId } = params;

    const msgType = await this.determineMessageType(phone, clinicId);
    console.log(`[DoctorLate] Window=${msgType} for ${phone}.`);

    if (msgType === 'free') {
      const text =
        `നമസ്കാരം ${patientName}, \n\nഡോക്ടർ ${doctorName} ഇന്ന് ഏകദേശം ${delayMinutes} മിനിറ്റ് വൈകും. ⏳\n\nക്ഷമിക്കണം, ദയവായി കൂടുതൽ സമയം കാത്തിരിക്കൂ.`;
      return this.sendWhatsAppMessage({ to: phone, clinicId, message: text });
    }

    return this.sendWhatsAppMessage({
      to: phone,
      clinicId,
      templateName: 'doctor_running_late_ml',
      templateVariables: { '1': patientName, '2': doctorName, '3': String(delayMinutes) },
    });
  }

  /**
   * Appointment Skipped Alert — Smart Dispatcher routed.
   * Template: appointment_skipped_ml
   * Free text: Inform patient their slot was skipped and the next steps.
   */
  async sendAppointmentSkippedAlert(params: {
    phone: string;
    patientName: string;
    tokenNumber: string;
    clinicId: string;
  }): Promise<boolean> {
    const { phone, patientName, tokenNumber, clinicId } = params;

    const msgType = await this.determineMessageType(phone, clinicId);
    console.log(`[Skipped] Window=${msgType} for ${phone}.`);

    if (msgType === 'free') {
      const text =
        `നമസ്കാരം ${patientName}, \n\nനിങ്ങളുടെ ടോക്കൺ ${tokenNumber} Skip ചെയ്യപ്പെട്ടു. ⚠️\n\nദയവായി Reception-ൽ ബന്ധപ്പെടുക.`;
      return this.sendWhatsAppMessage({ to: phone, clinicId, message: text });
    }

    return this.sendWhatsAppMessage({
      to: phone,
      clinicId,
      templateName: 'appointment_skipped_ml',
      templateVariables: { '1': patientName, '2': tokenNumber },
    });
  }

  // ───────────────────────────────────────────────────────
  // Existing methods (unchanged logic, preserved signatures)
  // ───────────────────────────────────────────────────────

  async notifySessionPatientsOfConsultationStart(params: {
    clinicId: string;
    doctorId: string;
    date: string;
    sessionIndex: number;
  }): Promise<void> {
    const { clinicId, doctorId, date, sessionIndex } = params;

    const clinic = await this.clinicRepo.findById(clinicId);
    const doctor = await this.doctorRepo.findById(doctorId, clinicId);
    if (!clinic || !doctor) return;

    const appointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, date);
    const sessionAppointments = appointments.filter(a =>
      a.sessionIndex === sessionIndex &&
      ['Pending', 'Confirmed', 'Skipped', 'No-show'].includes(a.status)
    );

    if (sessionAppointments.length === 0) return;

    const sorted = sessionAppointments.sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0));

    await Promise.all(sorted.map(async (apt, index) => {
      if (!apt.patientId) return;
      try {
        await this.sendDoctorConsultationStartedNotification({
          appointment: apt,
          clinicName: clinic.name,
          doctorName: doctor.name,
          peopleAhead: index,
          clinicId: clinic.id,
        });
      } catch (error) {
        console.error(`Failed to notify patient for appointment ${apt.id}:`, error);
      }
    }));
  }

  public async sendDoctorConsultationStartedNotification(params: {
    appointment: Appointment;
    clinicName: string;
    doctorName: string;
    peopleAhead: number;
    clinicId: string;
  }): Promise<boolean> {
    const { appointment, clinicName, doctorName, peopleAhead, clinicId } = params;

    const configs = await this.notificationRepo.findAllConfigs(clinicId);
    const config = configs.find(c => c.id === NOTIFICATION_TYPES.DOCTOR_CONSULTATION_STARTED);
    if (!config || (!config.pwaEnabled && !config.whatsappEnabled)) {
      console.log(`[Notification] Consultation started disabled for clinic ${clinicId}`);
      return true;
    }

    if (config?.pwaEnabled && appointment.patientId && this.fcmService) {
      this.fcmService.sendToUser(appointment.patientId, clinicId, {
        title: `Dr. ${doctorName} has started consultations`,
        body: `Your token: ${appointment.tokenNumber || ''}. Clinic: ${clinicName}.`,
        data: {
          appointmentId: appointment.id,
          type: 'consultation_started',
          clinicId,
        },
      }).catch(err => console.error('[FCM] Push failed:', err));
    }

    if (appointment.communicationPhone) {
      try {
        const patientName = appointment.patientName || 'Patient';
        const tokenNumber = appointment.tokenNumber || '';
        const linkSuffix = `${appointment.id}?ref=consultation_started`;

        const text =
          `നമസ്കാരം ${patientName},\n\nഡോക്ടർ ${doctorName} കൺസൾട്ടേഷൻ ആരംഭിച്ചു. 🟢\n\nടോക്കൺ: ${tokenNumber}\n\nhttps://app.kloqo.com/live-token/${linkSuffix}`;

        await this.sendWhatsAppMessage({
          to: appointment.communicationPhone,
          clinicId,
          message: text,
          templateName: 'doctor_consultation_started_ml',
          templateVariables: {
            '1': patientName,
            '2': doctorName,
            '3': tokenNumber,
            '4': linkSuffix,
          },
        });
      } catch (error) {
        console.error('[WhatsApp] Global send failure:', error);
      }
    }

    return true;
  }

  async sendAppointmentRescheduledNotification(params: {
    patientId: string;
    appointmentId: string;
    doctorName: string;
    clinicName: string;
    oldDate: string;
    oldTime: string;
    newDate: string;
    newTime: string;
    clinicId: string;
    communicationPhone?: string;
    patientName?: string;
  }): Promise<void> {
    const { 
      patientId, appointmentId, communicationPhone, patientName, 
      doctorName, clinicName, newDate, newTime, clinicId 
    } = params;

    const malayalamDateTime = getMalayalamFriendlyDateTime(newDate, newTime);

    // 1. WhatsApp
    if (communicationPhone) {
      const message = `നമസ്കാരം ${patientName || ''}, Dr. ${doctorName}-നോടൊത്തുള്ള നിങ്ങളുടെ അപ്പോയ്ൻ്റ്മെന്റ് സമയം മാറ്റിയിരിക്കുന്നു. ✅\n\nപുതിയ സമയം: ${malayalamDateTime}\n\nസ്ഥലം: ${clinicName}`;
      await this.sendWhatsAppMessage({ to: communicationPhone, message });
    }

    // 2. PWA Push
    if (patientId && this.fcmService) {
      this.fcmService.sendToUser(patientId, clinicId, {
        title: 'അപ്പോയ്ൻ്റ്മെന്റ് സമയം മാറ്റി (Rescheduled)',
        body: `Dr. ${doctorName}-നോടൊത്തുള്ള നിങ്ങളുടെ അപ്പോയ്ൻ്റ്മെന്റ് സമയം ${malayalamDateTime}-ലേക്ക് മാറ്റിയിരിക്കുന്നു.`,
        data: { appointmentId, type: 'appointment_rescheduled', clinicId }
      }).catch(err => console.error('[FCM] Reschedule push failed:', err));
    }
  }

  async notifyAllPatientsOfBreak(params: {
    clinicId: string;
    doctorId: string;
    date: string;
    durationMinutes: number;
    reason?: string;
  }): Promise<void> {
    const { clinicId, doctorId, date, durationMinutes, reason } = params;

    const doctor = await this.doctorRepo.findById(doctorId, clinicId);
    if (!doctor) return;

    const appointments = await this.appointmentRepo.findByDoctorAndDate(doctorId, clinicId, date);
    const activeAppointments = appointments.filter(a => 
      ['Pending', 'Confirmed'].includes(a.status) && a.patientId
    );

    if (activeAppointments.length === 0) return;

    await Promise.allSettled(activeAppointments.map(async a => {
      if (this.fcmService && a.patientId) {
        this.fcmService.sendToUser(a.patientId, clinicId, {
          title: 'ഡോക്ടർ ചെറിയ ബ്രേക്കിലാണ് (Short Break)',
          body: `ഡോക്ടർ ${doctor.name} ${durationMinutes} മിനിറ്റ് ബ്രേക്കിലാണ്. നിങ്ങളുടെ ഊഴം അല്പം വൈകാൻ സാധ്യതയുണ്ട്. ⏳`,
          data: { appointmentId: a.id, type: 'doctor_break', clinicId }
        });
      }
    }));
  }

  /**
   * Universal Reminder Engine
   * Finds appointments in specific time windows and sends PWA/WhatsApp reminders.
   */
  async sendScheduledReminders(clinicId: string): Promise<{ sent: number }> {
    const now = getClinicNow();
    const todayStr = format(now, 'yyyy-MM-dd');
    const inTwoDaysStr = format(addDays(now, 2), 'yyyy-MM-dd');

    let sentCount = 0;

    // 1. Reminders for 2 days ahead
    const twoDaysApps = await this.appointmentRepo.findByClinicAndDate(clinicId, inTwoDaysStr);
    for (const app of twoDaysApps) {
      if (app.status === 'Confirmed' || app.status === 'Pending') {
        await this.sendAppointmentReminders(app, '2_days');
        sentCount++;
      }
    }

    // 2. Today's Appointments (Morning and 3-hour window)
    const todayApps = await this.appointmentRepo.findByClinicAndDate(clinicId, todayStr);
    for (const app of todayApps) {
      if (app.status !== 'Confirmed' && app.status !== 'Pending') continue;

      // A. Today Morning Reminder (Send if it's currently 6 AM - 10 AM)
      const currentHour = now.getHours();
      if (currentHour >= 6 && currentHour <= 10) {
        await this.sendAppointmentReminders(app, 'today_morning');
        sentCount++;
      }

      // B. 3-Hour Proximity Reminder
      try {
        const appTime = parse(app.time, 'h:mm a', now);
        const diffMs = appTime.getTime() - now.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        // If app is within 160-180 minutes (approx 3 hours)
        if (diffMinutes >= 160 && diffMinutes <= 190) {
          await this.sendAppointmentReminders(app, '3_hours');
          sentCount++;
        }
      } catch (err) {
        // console.error('[Reminder] Date parse failed:', app.time);
      }
    }

    return { sent: sentCount };
  }

  private async sendAppointmentReminders(appointment: Appointment, window: '2_days' | 'today_morning' | '3_hours'): Promise<void> {
    const clinicId = appointment.clinicId;
    const patientId = appointment.patientId;
    
    let title = 'അപ്പോയ്ൻ്റ്മെന്റ് ഓർമ്മപ്പെടുത്തൽ (Reminder)';
    let body = '';

    if (window === '2_days') {
      body = `Dr. ${appointment.doctorName}-നോടൊത്തുള്ള നിങ്ങളുടെ അപ്പോയ്ൻ്റ്മെന്റ് 2 ദിവസത്തിന് ശേഷമാണ്. (${appointment.date})`;
    } else if (window === 'today_morning') {
      body = `Dr. ${appointment.doctorName}-നോടൊത്തുള്ള നിങ്ങളുടെ അപ്പോയ്ൻ്റ്മെന്റ് ഇന്നാണ്. കൃത്യസമയത്ത് എത്താൻ ശ്രദ്ധിക്കുമല്ലോ.`;
    } else if (window === '3_hours') {
      body = `Dr. ${appointment.doctorName}-നോടൊത്തുള്ള നിങ്ങളുടെ അപ്പോയ്ൻ്റ്മെന്റ് അടുത്ത 3 മണിക്കൂറിനുള്ളിലാണ്. 🏥`;
    }

    if (patientId && this.fcmService) {
      this.fcmService.sendToUser(patientId, clinicId, {
        title,
        body,
        data: { appointmentId: appointment.id, type: 'appointment_reminder', window }
      }).catch(err => console.error('[FCM] Reminder push failed:', err));
    }
  }

  async sendQueuePositionUpdateNotification(params: {
    patientId: string;
    appointmentId: string;
    clinicName: string;
    peopleAhead: number;
    clinicId: string;
    communicationPhone?: string;
    patientName?: string;
  }): Promise<void> {
    const { patientId, appointmentId, communicationPhone, patientName, peopleAhead, clinicId, clinicName } = params;

    // 1. WhatsApp (if needed)
    if (communicationPhone) {
      const message = `ഹലോ ${patientName}, ${clinicName}-ൽ നിങ്ങളുടെ മുൻപിൽ ഇനി ${peopleAhead} പേർ കൂടി മാത്രമേ ഉള്ളൂ. ദയവായി തയ്യാറായിരിക്കുക. 🏥`;
      await this.sendWhatsAppMessage({ to: communicationPhone, message });
    }

    // 2. PWA Push
    if (patientId && this.fcmService) {
      this.fcmService.sendToUser(patientId, clinicId, {
        title: 'നിങ്ങളുടെ ഊഴം ഉടനെത്തും!',
        body: `മുൻപിൽ ഇനി ${peopleAhead} പേർ കൂടി മാത്രം. ദയവായി തയ്യാറായിരിക്കുക. 🩺`,
        data: { appointmentId, type: 'queue_update', clinicId, peopleAhead: String(peopleAhead) }
      }).catch(err => console.error('[FCM] Queue position push failed:', err));
    }
  }

  async sendAppointmentBookedNotification(params: {
    patientId: string;
    appointmentId: string;
    doctorName: string;
    clinicName: string;
    date: string;
    time: string;
    clinicId: string;
    tokenNumber?: string;
  }): Promise<void> {
    const { patientId, appointmentId, doctorName, clinicName, date, time, clinicId, tokenNumber } = params;

    const malayalamDateTime = getMalayalamFriendlyDateTime(date, time);

    if (patientId && this.fcmService) {
      this.fcmService.sendToUser(patientId, clinicId, {
        title: 'അപ്പോയ്ൻ്റ്മെന്റ് ബുക്ക് ചെയ്തു ✅',
        body: `Dr. ${doctorName}-നോടൊത്തുള്ള നിങ്ങളുടെ അപ്പോയ്ൻ്റ്മെന്റ് (${malayalamDateTime}) വിജയകരമായി ബുക്ക് ചെയ്തിരിക്കുന്നു. ടോക്കൺ: ${tokenNumber || '--'}`,
        data: { appointmentId, type: 'appointment_booked', clinicId }
      }).catch(err => console.error('[FCM] Booking push failed:', err));
    }
  }

  async notifyNextPatientsWhenCompleted(params: {
    clinicId: string;
    completedAppointmentId: string;
    completedAppointment: Appointment;
    clinicName: string;
  }): Promise<void> {
    const { clinicId, completedAppointment, clinicName } = params;
    const date = format(new Date(), 'yyyy-MM-dd');

    const appointments = await this.appointmentRepo.findByClinicAndDate(clinicId, date);
    const doctorAppointments = appointments.filter(a =>
      a.doctorName === completedAppointment.doctorName &&
      ['Confirmed', 'Pending'].includes(a.status) &&
      a.id !== completedAppointment.id
    );

    const sorted = doctorAppointments.sort((a, b) => (a.slotIndex || 0) - (b.slotIndex || 0));
    
    // Notify the next few people for "Live Tracking"
    const nextFive = sorted.slice(0, 5);

    for (let i = 0; i < nextFive.length; i++) {
      const apt = nextFive[i];
      const position = i + 1;

      // WhatsApp for #1 and #2
      if (position <= 2 && apt.communicationPhone) {
        const message = `ഹലോ ${apt.patientName}, ${clinicName}-ൽ നിങ്ങളുടെ മുൻപിൽ ഇനി ${position} പേർ കൂടി മാത്രമേ ഉള്ളൂ. ദയവായി തയ്യാറായിരിക്കുക.`;
        await this.sendWhatsAppMessage({ to: apt.communicationPhone, message });
      }

      // PWA Push for all 5 (Zomato-style tracking)
      if (apt.patientId && this.fcmService) {
        this.fcmService.sendToUser(apt.patientId, clinicId, {
          title: position === 1 ? 'അടുത്തത് നിങ്ങളാണ്!' : `ക്യൂ നിലവിവരം: #${position}`,
          body: position === 1 
            ? 'ദയവായി ഡോക്ടറുടെ മുറിയുടെ അടുത്തേക്ക് വരൂ.' 
            : `നിങ്ങളുടെ മുൻപിൽ ${position - 1} പേർ കൂടിയുണ്ട്.`,
          data: { appointmentId: apt.id, type: 'queue_update', position: String(position) }
        }).catch(err => console.error('[FCM] Live tracking push failed:', err));
      }
    }
  }

  async sendAppointmentCancelledNotification(params: {
    patientId: string;
    appointmentId: string;
    doctorName: string;
    clinicName: string;
    date: string;
    time: string;
    clinicId: string;
    communicationPhone?: string;
    patientName?: string;
    reason?: string;
  }): Promise<void> {
    const { 
      patientId, appointmentId, communicationPhone, patientName, 
      doctorName, clinicName, date, time, reason, clinicId 
    } = params;
 
    const isDoctorLeave = reason === 'Doctor on leave';
    const displayReason = isDoctorLeave ? 'ഡോക്ടർ അവധിയിലാണ്' : (reason || 'സാങ്കേതിക കാരണങ്ങൾ');
 
    // 1. WhatsApp Notification
    if (communicationPhone) {
      const message = `ക്ഷമിക്കണം ${patientName || ''}, Dr. ${doctorName}-നോടൊത്തുള്ള ${clinicName}-ലെ ${date} ${time}-ലെ അപ്പോയ്ൻ്റ്മെന്റ് റദ്ദ് ചെയ്തിട്ടുണ്ട്. കാരണം: ${displayReason}.`;
      await this.sendWhatsAppMessage({ to: communicationPhone, message });
    }
 
    // 2. PWA / FCM Push Notification
    if (patientId && this.fcmService) {
      this.fcmService.sendToUser(patientId, clinicId, {
        title: 'അപ്പോയ്ൻ്റ്മെന്റ് റദ്ദാക്കി (Cancelled)',
        body: `Dr. ${doctorName}-നോടൊത്തുള്ള നിങ്ങളുടെ അപ്പോയ്ൻ്റ്മെന്റ് (${date}) റദ്ദാക്കി. കാരണം: ${displayReason}.`,
        data: {
          appointmentId,
          type: 'appointment_cancelled',
          reason: displayReason
        }
      }).catch(err => console.error('[FCM] Cancellation push failed:', err));
    }
  }

  async sendWhatsAppBookingLink(params: {
    phone: string;
    clinicName: string;
    clinicId: string;
    patientName: string;
  }): Promise<void> {
    const { phone, clinicName, clinicId, patientName } = params;
    const bookingUrl = `https://book.kloqo.com/clinic/${clinicId}`;

    await this.sendWhatsAppMessage({
      to: phone,
      message: `Halo ${patientName}! ${clinicName}-ൽ രജിസ്റ്റർ ചെയ്തു. അപ്പോയ്ൻ്റ്മെന്റ് ബുക്ക് ചെയ്യുക: ${bookingUrl}`,
    });
  }

  async sendPrescriptionToPharmacy(params: {
    pharmacyPhone: string;
    prescriptionUrl: string;
    patientName: string;
    clinicName: string;
    clinicId: string;
  }): Promise<void> {
    const { pharmacyPhone, prescriptionUrl, patientName, clinicName, clinicId } = params;

    await this.sendWhatsAppMessage({
      to: pharmacyPhone,
      clinicId,
      message: `Prescription for ${patientName} from ${clinicName}. Link: ${prescriptionUrl}`,
      templateName: 'prescription_media_forward',
      templateVariables: { '1': patientName, '2': clinicName },
      mediaUrl: prescriptionUrl,
    });
  }

  async sendPrescriptionTriageToPatient(params: {
    phone: string;
    patientName: string;
    clinicName: string;
    clinicId: string;
    appointmentId: string;
  }): Promise<void> {
    const { phone, patientName, clinicName, clinicId, appointmentId } = params;

    const message = `Your prescription has been sent to the clinic pharmacy. Please head to the counter to collect your medicines. \n\nReply 'DIGITAL' if you are leaving the clinic and only need a digital copy.`;

    await this.sendWhatsAppMessage({
      to: phone,
      clinicId,
      message,
      templateName: 'prescription_triage_collection',
      templateVariables: {
        '1': patientName,
        '2': clinicName,
      },
      buttonPayloads: [
        { index: 0, payload: `RX_TRIAGE_DIGITAL_${appointmentId}` },
      ],
    });
  }
}
