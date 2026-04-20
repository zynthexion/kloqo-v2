import { Router, Request, Response } from 'express';
import express from 'express';
import multer from 'multer';
import { container } from '../../infrastructure/webserver/express/Container';
import { createMiddleware } from '../../infrastructure/webserver/express/middleware';
import { verifyWhatsAppSignature } from '../../infrastructure/webserver/middleware/VerifyWhatsAppSignature';
import { cronAuthMiddleware } from '../../infrastructure/webserver/middleware/CronAuthMiddleware';
import { KLOQO_ROLES } from '@kloqo/shared';

const { CLINIC_ADMIN, DOCTOR, NURSE, PHARMACIST, SUPER_ADMIN } = KLOQO_ROLES;

const router = Router();
const { auth, checkRole } = createMiddleware(container.verifySessionUseCase);
const upload = multer({ storage: multer.memoryStorage() });

const { prescriptionController, appointmentController, doctorController,
        notificationController, analyticsController, webhookController, whatsappWebhookController,
        paymentController, storageController, sseController, fcmService,
        processGracePeriodsUseCase } = container;

// ── Breaks ────────────────────────────────────────────────────────────────
router.post('/breaks/schedule', auth, (req, res) => doctorController.scheduleBreak(req, res));
router.post('/breaks/edit', auth, (req, res) => doctorController.editBreak(req, res));
router.post('/breaks/cancel', auth, (req, res) => doctorController.cancelBreak(req, res));

// ── Prescriptions ─────────────────────────────────────────────────────────
router.post('/prescriptions/upload', auth, checkRole(NURSE, DOCTOR, CLINIC_ADMIN, SUPER_ADMIN), upload.single('file'), (req, res) => prescriptionController.upload(req, res));
router.get('/prescriptions/patient/:patientId', auth, (req, res) => prescriptionController.getByPatient(req, res));
router.patch('/prescriptions/:appointmentId/dispense', auth, checkRole(PHARMACIST, CLINIC_ADMIN, SUPER_ADMIN), (req, res) => prescriptionController.dispense(req, res));
router.patch('/prescriptions/:appointmentId/abandon', auth, checkRole(PHARMACIST, CLINIC_ADMIN, SUPER_ADMIN), (req, res) => prescriptionController.abandon(req, res));

// ── Storage ────────────────────────────────────────────────────────────────
router.post('/storage/upload', auth, checkRole(NURSE, DOCTOR, PHARMACIST, CLINIC_ADMIN, SUPER_ADMIN), upload.single('file'), (req, res) => storageController.upload(req, res));

// ── Payments (unauthenticated — secured by Razorpay signature) ────────────
router.post('/payments/create-order', (req, res) => paymentController.createOrder(req, res));
router.post('/payments/verify', (req, res) => paymentController.verifyPayment(req, res));
router.post('/billing/verify-upgrade', auth, (req, res) => paymentController.verifyUpgrade(req, res));

// ── Webhooks (Razorpay) ───────────────────────────────────────────────────
router.post('/webhooks/razorpay', (req, res) => webhookController.handleRazorpay(req, res));

// ── WhatsApp Webhooks ─────────────────────────────────────────────────────
// GET: Meta's one-time hub challenge verification (no auth, no signature check)
router.get('/webhooks/whatsapp', (req, res) => whatsappWebhookController.verifyWebhook(req, res));
// POST: Live incoming messages — must use express.raw() FIRST so the raw buffer
//       is available for HMAC-SHA256 signature verification (Rule 13).
router.post(
  '/webhooks/whatsapp',
  express.raw({ type: '*/*' }),
  verifyWhatsAppSignature,
  (req, res) => whatsappWebhookController.handleIncomingMessage(req, res)
);

// ── Notifications ─────────────────────────────────────────────────────────
router.post('/notifications/batch', (req, res) => notificationController.processBatchNotifications(req, res));
router.post('/notifications/send-link', (req, res) => notificationController.sendBookingLink(req, res));

// ── Cron Jobs (protected by X-Cron-Secret header) ─────────────────────────
// Frequency: Every 5 minutes (or gracePeriod / 2, floored at 5 min).
// Body: { clinicId: string }
router.post('/notifications/cron/grace-periods', cronAuthMiddleware, async (req: any, res: Response) => {
  try {
    const { clinicId } = req.body;
    if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
    const result = await processGracePeriodsUseCase.execute(clinicId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Cron/GracePeriods]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Error Logging (called by frontends, no auth required) ────────
router.post('/log-error', (req, res) => analyticsController.logError(req, res));

// ── SSE (Server-Sent Events) ─────────────────────────────────────────────
router.get('/events/clinic/:clinicId', (req, res) => sseController.handleClinicStream(req, res));

// ── FCM Token Management ──────────────────────────────────────────────────
router.post('/users/me/fcm-token', auth, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const { fcmToken } = req.body;
    if (!userId || !fcmToken) return res.status(400).json({ error: 'fcmToken is required' });
    await fcmService.storeToken(userId, fcmToken);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.delete('/users/me/fcm-token', auth, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id || req.user?.uid;
    const { fcmToken } = req.body;
    if (!userId || !fcmToken) return res.status(400).json({ error: 'fcmToken is required' });
    await fcmService.removeToken(userId, fcmToken);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
