import { Request, Response } from 'express';
import { IAppointmentRepository } from '../../../domain/repositories';
import { UpdateAppointmentStatusUseCase } from '../../../application/UpdateAppointmentStatusUseCase';
import { Appointment } from '../../../../../packages/shared/src/index';

// ─────────────────────────────────────────────────────────────────────────────
// GA4 Measurement Protocol — Webhook Efficiency Tracking
// Tracks Confirm/Cancel rates from WhatsApp button clicks.
// Fails silently — analytics NEVER block the main webhook response.
// ─────────────────────────────────────────────────────────────────────────────

const GA4_ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA4_MEASUREMENT_ID}&api_secret=${process.env.GA4_API_SECRET}`;

/**
 * Fires a GA4 Measurement Protocol event.
 * client_id is set to appointmentId so each button click is attributable.
 */
function trackGA4Event(
  eventName: 'wa_reminder_confirmed' | 'wa_reminder_cancelled',
  params: Record<string, string>,
  appointmentId: string
): void {
  if (!process.env.GA4_MEASUREMENT_ID || !process.env.GA4_API_SECRET) return;

  const payload = JSON.stringify({
    client_id: appointmentId,  // Synthetic ID — unique per appointment
    events: [{
      name: eventName,
      params: { engagement_time_msec: 1, ...params },
    }],
  });

  fetch(GA4_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  }).catch(err => console.warn(`[GA4] Silent failure for ${eventName}:`, err));
}

// ─────────────────────────────────────────────────────────────────────────────

import { NotificationService } from '../../../domain/services/NotificationService';

// ... existing code ...

export class WhatsAppWebhookController {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private updateStatusUseCase: UpdateAppointmentStatusUseCase,
    private notificationService: NotificationService
  ) {}

  // Handles Meta's hub.challenge verification
  async verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }

  // Handles inbound webhook interactions
  async handleIncomingMessage(req: Request, res: Response) {
    try {
      // 1. Payload Parsing
      const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message || message.type !== 'interactive') {
        // Not an interactive message or button reply, we don't care right now.
        return res.sendStatus(200);
      }

      const buttonId = message.interactive?.button_reply?.id as string;
      if (!buttonId) return res.sendStatus(200);

      // 2. Status Mapping
      let mappedStatus: Appointment['status'] | undefined;
      let appointmentId: string | undefined;
      let isTriageDigital = false;

      if (buttonId.startsWith('APP_CONFIRM_')) {
        mappedStatus = 'Confirmed';
        appointmentId = buttonId.replace('APP_CONFIRM_', '');
      } else if (buttonId.startsWith('APP_CANCEL_')) {
        mappedStatus = 'Cancelled';
        appointmentId = buttonId.replace('APP_CANCEL_', '');
      } else if (buttonId.startsWith('RX_TRIAGE_DIGITAL_')) {
        isTriageDigital = true;
        appointmentId = buttonId.replace('RX_TRIAGE_DIGITAL_', '');
      }

      if (!appointmentId) {
        return res.sendStatus(200); // Ignore unknown buttons
      }

      // 3. Tenant Security Flow (Rule 15 Enforcement)
      const appointment = await this.appointmentRepo.findById(appointmentId);
      if (!appointment) {
        console.warn(`Webhook triggered for missing appointment: ${appointmentId}`);
        return res.sendStatus(200); // Meta stops retrying
      }

      // 4. Handle Digital Triage (Omnichannel)
      if (isTriageDigital) {
        // Set to abandoned so it leaves the pharmacist queue instantly
        await this.appointmentRepo.update(appointment.id, {
          pharmacyStatus: 'abandoned',
          abandonedReason: 'Requested Digital via WhatsApp',
          updatedAt: new Date()
        });

        // Push the PDF PDF link as a follow up
        if (appointment.prescriptionUrl && appointment.communicationPhone) {
          await this.notificationService.sendWhatsAppMessage({
            to: appointment.communicationPhone,
            clinicId: appointment.clinicId,
            message: `Here is your digital prescription: ${appointment.prescriptionUrl}\n\nHave a great day! 🌸`
          });
        }
        
        return res.sendStatus(200);
      }

      // 5. Delegate pure status update (Confirmed/Cancelled), strictly bound by the DB-resolved clinicId
      if (mappedStatus) {
        await this.updateStatusUseCase.execute({
          appointmentId: appointment.id,
          status: mappedStatus,
          clinicId: appointment.clinicId
        });

        // 6. Fire GA4 efficiency event — zero Firestore cost (Rule 14)
        const ga4Event = mappedStatus === 'Confirmed'
          ? 'wa_reminder_confirmed'
          : 'wa_reminder_cancelled';

        trackGA4Event(ga4Event, { clinicId: appointment.clinicId }, appointmentId);
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('[WhatsAppWebhookController] Processing error:', error);
      // Still return 200 to prevent Meta from spamming retries for unrecoverable domain errors
      res.sendStatus(200);
    }
  }
}
