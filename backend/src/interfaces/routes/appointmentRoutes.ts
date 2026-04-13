import { Router } from 'express';
import { container } from '../../infrastructure/webserver/express/Container';
import { createMiddleware } from '../../infrastructure/webserver/express/middleware';
import { Role } from '@kloqo/shared';

const router = Router();
const { auth, checkRole } = createMiddleware(container.verifySessionUseCase);
const { appointmentController } = container;

// ── Public discovery (patient-app, unauthenticated) ───────────────────────
router.get('/public', (req, res) => appointmentController.getPublicAppointments(req, res));
router.get('/public/check-slot', (req, res) => appointmentController.checkSlot(req, res));

// ── Authenticated history and booking (Authenticated) ─────────────────────
// Restore root GET for filtered history (used by ReviewChecker)
router.get('/', auth, (req, res) => appointmentController.getAppointments(req, res));
router.post('/walk-in', auth, (req, res) => appointmentController.createWalkIn(req, res));
router.post('/advanced', auth, (req, res) => appointmentController.bookAdvanced(req, res));

// ── Live Queue status (patient-app public) ─────────────────────────────────
router.get('/discovery/clinics/:id/doctors/:doctorId/queue', async (req: any, res: any) => {
  try {
    const { id, doctorId } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });
    const status = await container.getPublicQueueStatusUseCase.execute(id, doctorId, date as string, req.user?.patientId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Authenticated appointment operations ───────────────────────────────────
const clinicStaffRoles: Role[] = ['clinicAdmin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'superAdmin'];
const staffGuard = [auth, checkRole(...clinicStaffRoles)];

router.get('/dashboard', staffGuard, (req: any, res: any) => appointmentController.getNurseDashboard(req, res));
router.get('/clinic/appointments', staffGuard, (req: any, res: any) => appointmentController.getClinicAppointments(req, res));
router.patch('/:id/status', staffGuard, (req: any, res: any) => appointmentController.updateStatus(req, res));
router.post('/:id/confirm', staffGuard, (req: any, res: any) => appointmentController.confirmArrival(req, res));
router.delete('/:id', staffGuard, (req: any, res: any) => appointmentController.deleteAppointment(req, res));
router.post('/book', staffGuard, (req: any, res: any) => appointmentController.book(req, res));
router.post('/send-link', staffGuard, (req: any, res: any) => appointmentController.sendBookingLink(req, res));
router.get('/walk-in-estimate', staffGuard, (req: any, res: any) => appointmentController.getWalkInEstimate(req, res));
router.get('/walk-in-preview', staffGuard, (req: any, res: any) => appointmentController.getWalkInPreview(req, res));
router.get('/available-slots', staffGuard, (req: any, res: any) => appointmentController.getAvailableSlots(req, res));
// Legacy path alias kept for backward compatibility
router.get('/slots', staffGuard, (req: any, res: any) => appointmentController.getAvailableSlots(req, res));

export default router;
