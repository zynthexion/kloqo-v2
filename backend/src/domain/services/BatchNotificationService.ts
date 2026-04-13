import { IAppointmentRepository, IDoctorRepository, IClinicRepository, INotificationRepository } from '../repositories';
import { NotificationService } from './NotificationService';
import { Appointment } from '../../../../packages/shared/src/index';
import {
  getClinicNow,
  getClinicDateString,
} from '@kloqo/shared-core';
import { addDays } from 'date-fns';
import * as admin from 'firebase-admin';
import { db } from '../../infrastructure/firebase/config';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Current YYYY-MM for billing
// ─────────────────────────────────────────────────────────────────────────────
function currentBillingMonth(): string {
  const now = getClinicNow(); // IST-aware
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Atomic usage increment and 999-plan check
// Subcollection: clinics/{clinicId}/usage/{YYYY-MM}
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_999_LIMIT = 500;

async function checkUsageLimit(clinicId: string, plan: string | undefined): Promise<boolean> {
  if (plan !== '999') return true; // Unlimited for all other plans

  const month = currentBillingMonth();
  const usageRef = db.collection('clinics').doc(clinicId).collection('usage').doc(month);
  const snap = await usageRef.get();
  const current = snap.exists ? (snap.data()!.whatsappSentCount as number || 0) : 0;

  if (current >= PLAN_999_LIMIT) {
    console.log(`[Usage] ❌ Clinic ${clinicId} has hit its 999 Plan limit (${current}/${PLAN_999_LIMIT}). Skipping.`);
    return false;
  }
  return true;
}

async function incrementUsage(clinicId: string): Promise<void> {
  const month = currentBillingMonth();
  const usageRef = db.collection('clinics').doc(clinicId).collection('usage').doc(month);
  // Atomic increment — Rule 10: no race conditions during batch loops
  await usageRef.set(
    { whatsappSentCount: admin.firestore.FieldValue.increment(1), month, clinicId },
    { merge: true }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: time string comparison  e.g. "09:30" → integer 930 for easy range checks
// ─────────────────────────────────────────────────────────────────────────────
function timeToInt(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return parseInt(h, 10) * 100 + parseInt(m, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// BatchNotificationService
// ─────────────────────────────────────────────────────────────────────────────

export class BatchNotificationService {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private clinicRepo: IClinicRepository,
    private notificationRepo: INotificationRepository,
    private notificationService: NotificationService,
    private syncAllSubscriptionsUseCase: import('../../application/SyncAllSubscriptionsUseCase').SyncAllSubscriptionsUseCase
  ) {}

  // ── Per-clinic convenience wrappers (kept for existing cron routes) ─────

  async processMorningReminders(clinicId: string): Promise<void> {
    const today = getClinicDateString(getClinicNow());
    await this._sendBatchForClinic(clinicId, today, '7AM');
  }

  async processEveningReminders(clinicId: string): Promise<void> {
    const tomorrow = getClinicDateString(addDays(getClinicNow(), 1));
    await this._sendBatchForClinic(clinicId, tomorrow, '5PM');
  }

  async checkFollowUpExpiries(clinicId: string): Promise<void> {
    const clinic = await this.clinicRepo.findById(clinicId);
    if (!clinic) return;

    const doctors = await this.doctorRepo.findByClinicId(clinicId);
    const doctorList = Array.isArray(doctors) ? doctors : doctors.data;

    for (const doctor of doctorList) {
      if (!doctor.freeFollowUpDays || doctor.freeFollowUpDays <= 3) continue;

      const targetDate = getClinicDateString(addDays(getClinicNow(), -(doctor.freeFollowUpDays - 3)));
      const appointments = await this.appointmentRepo.findByClinicAndDate(clinicId, targetDate);

      const finished = appointments.filter(a =>
        a.doctorName === doctor.name &&
        a.status === 'Completed' &&
        !(a as any).freeFollowUpNotificationSent
      );

      for (const apt of finished) {
        // TODO: Implement free-follow-up expiry notification via NotificationService
        console.log(`[FollowUp] Patient ${apt.patientName} follow-up expiry alert due.`);
      }
    }
  }

  async syncTrialExpirations(): Promise<void> {
    await this.syncAllSubscriptionsUseCase.execute();
  }

  // ── Global Batch — Reverse Query (Single DB read, in-memory grouping) ───
  /**
   * GLOBAL batch runner — to be called from a single daily cron endpoint.
   *
   *  5 PM run → passes TYPE='5PM', targetDate=Tomorrow, processes appointments whose
   *              `time` falls in the AM block (00:00–11:59)
   *
   *  7 AM run → passes TYPE='7AM', targetDate=Today, processes appointments whose
   *              `time` falls in the PM block (12:00–23:59)
   *
   * Uses a REVERSE QUERY: single read on `appointments` collection, then groups
   * by clinicId in memory. This avoids the N+1 problem when there are many clinics.
   */
  async processGlobalBatch(type: '7AM' | '5PM'): Promise<{ total: number; succeeded: number; skipped: number }> {
    const now = getClinicNow(); // IST-aware (Rule 8)

    let targetDate: string;
    let timeMin: number;  // appointments whose time (HH:mm) is >= timeMin
    let timeMax: number;  // and <= timeMax
    const sentFlag = type === '5PM' ? 'whatsappReminder5PMSent' : 'whatsappReminder7AMSent';

    if (type === '5PM') {
      // 5 PM cron: remind tomorrow's MORNING appointments
      targetDate = getClinicDateString(addDays(now, 1));
      timeMin = 0;     // 00:00
      timeMax = 1159;  // 11:59
    } else {
      // 7 AM cron: remind today's AFTERNOON/EVENING appointments
      targetDate = getClinicDateString(now);
      timeMin = 1200;  // 12:00
      timeMax = 2359;  // 23:59
    }

    console.log(`[GlobalBatch] 🚀 ${type} run — target date: ${targetDate}, time window: ${timeMin}-${timeMax}`);

    // ── 1. Single global query — one read operation for the entire platform ──
    const allAppointments = await this.appointmentRepo.findByClinicAndDate('', targetDate)
      .catch(() => [] as Appointment[]);

    // Fallback: that method may require clinicId. Use a raw Firestore query.
    const snap = await db
      .collection('appointments')
      .where('date', '==', targetDate)
      .where('status', 'in', ['Pending', 'Confirmed'])
      .where(sentFlag, '==', false)
      .get()
      .catch(err => {
        console.error('[GlobalBatch] Firestore query error:', err);
        return null;
      });

    if (!snap || snap.empty) {
      console.log(`[GlobalBatch] No pending appointments found for ${type} batch on ${targetDate}.`);
      return { total: 0, succeeded: 0, skipped: 0 };
    }

    // ── 2. In-memory grouping by clinicId ──
    const byClinic = new Map<string, Appointment[]>();
    snap.forEach(doc => {
      const data = { id: doc.id, ...doc.data() } as Appointment;
      const tid = timeToInt((data as any).time ?? '');

      // Time-window filter (in-memory — Rule: 5PM batch = AM appts, 7AM batch = PM appts)
      if (tid < timeMin || tid > timeMax) return;

      const list = byClinic.get(data.clinicId) ?? [];
      list.push(data);
      byClinic.set(data.clinicId, list);
    });

    let total = 0, succeeded = 0, skipped = 0;

    // ── 3. Per-clinic dispatch with billing guard ──
    for (const [clinicId, appointments] of byClinic.entries()) {
      const clinic = await this.clinicRepo.findById(clinicId);
      if (!clinic) continue;

      for (const apt of appointments) {
        if (!apt.communicationPhone) { skipped++; continue; }

        total++;

        // Plan-based limit check (999 Plan = 500/month)
        const allowed = await checkUsageLimit(clinicId, clinic.plan);
        if (!allowed) { skipped++; continue; }

        const success = await this.notificationService.sendWhatsAppReminderNotification({
          phone: apt.communicationPhone,
          patientName: apt.patientName,
          doctorName: apt.doctorName,
          clinicName: clinic.name,
          date: apt.date,
          time: apt.time,
          appointmentId: apt.id,
          tokenNumber: (apt as any).tokenNumber,
          clinicId,
        });

        if (success) {
          // Atomic billing increment
          await incrementUsage(clinicId);
          // Mark sent flag
          await this.appointmentRepo.update(apt.id, { [sentFlag]: true } as any);
          succeeded++;
        } else {
          skipped++;
        }
      }
    }

    console.log(`[GlobalBatch] ✅ Done. Total: ${total}, Sent: ${succeeded}, Skipped: ${skipped}`);
    return { total, succeeded, skipped };
  }

  // ── Internal per-clinic sender (used by per-clinic convenience wrappers) ─

  private async _sendBatchForClinic(clinicId: string, date: string, type: '7AM' | '5PM'): Promise<void> {
    const clinic = await this.clinicRepo.findById(clinicId);
    if (!clinic) return;

    const sentFlag = type === '7AM' ? 'whatsappReminder7AMSent' : 'whatsappReminder5PMSent';

    const appointments = await this.appointmentRepo.findByClinicAndDate(clinicId, date);
    const eligible = appointments.filter(a =>
      (a.status === 'Pending' || a.status === 'Confirmed') &&
      !a.cancelledByBreak &&
      !(a as any)[sentFlag]
    );

    for (const apt of eligible) {
      if (!apt.communicationPhone) continue;

      const allowed = await checkUsageLimit(clinicId, clinic.plan);
      if (!allowed) continue;

      const success = await this.notificationService.sendWhatsAppReminderNotification({
        phone: apt.communicationPhone,
        patientName: apt.patientName,
        doctorName: apt.doctorName,
        clinicName: clinic.name,
        date: apt.date,
        time: apt.time,
        appointmentId: apt.id,
        tokenNumber: (apt as any).tokenNumber,
        clinicId,
      });

      if (success) {
        await incrementUsage(clinicId);
        await this.appointmentRepo.update(apt.id, { [sentFlag]: true } as any);
      }
    }
  }
}
