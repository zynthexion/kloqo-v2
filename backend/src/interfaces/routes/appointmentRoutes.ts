import { Router } from 'express';
import { container } from '../../infrastructure/webserver/express/Container';
import { createMiddleware } from '../../infrastructure/webserver/express/middleware';
import { KloqoRole, KLOQO_ROLES } from '@kloqo/shared';

const router = Router();
const { auth, checkRole } = createMiddleware(container.verifySessionUseCase);
const { appointmentController } = container;


// ── Authenticated history and booking (Authenticated) ─────────────────────
// Restore root GET for filtered history (used by ReviewChecker)
router.get('/', auth, (req, res) => appointmentController.getAppointments(req, res));
router.post('/walk-in', auth, (req, res) => appointmentController.createWalkIn(req, res));
router.post('/advanced', auth, (req, res) => appointmentController.bookAdvanced(req, res));
router.post('/book-advanced', auth, (req, res) => appointmentController.bookAdvanced(req, res));


// ── Authenticated appointment operations ───────────────────────────────────
const { CLINIC_ADMIN, DOCTOR, NURSE, RECEPTIONIST, PHARMACIST, SUPER_ADMIN } = KLOQO_ROLES;
const clinicStaffRoles: KloqoRole[] = [CLINIC_ADMIN, DOCTOR, NURSE, RECEPTIONIST, PHARMACIST, SUPER_ADMIN];
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
