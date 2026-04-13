import { Router } from 'express';
import { container } from '../../infrastructure/webserver/express/Container';
import { createMiddleware } from '../../infrastructure/webserver/express/middleware';

import { Role } from '@kloqo/shared';

const router = Router();
const { auth, checkRole } = createMiddleware(container.verifySessionUseCase);
const { doctorController } = container;

const clinicStaffRoles: Role[] = ['clinicAdmin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'superAdmin'];
const staffGuard = [auth, checkRole(...clinicStaffRoles)];

// ── Public doctor list ─────────────────────────────────────────────────────
router.get('/', (req: any, res: any) => doctorController.getAllDoctors(req, res));
router.get('/:id', (req: any, res: any) => doctorController.getDoctor(req, res));
router.get('/:id/slots', staffGuard, (req: any, res: any) => doctorController.getAvailableSlots(req, res));

// ── Authenticated doctor operations ───────────────────────────────────────
router.patch('/:id/consultation-status', staffGuard, (req: any, res: any) => doctorController.updateConsultationStatus(req, res));
router.patch('/:id', staffGuard, (req: any, res: any) => doctorController.saveDoctor(req, res));
router.patch('/:id/availability', staffGuard, (req: any, res: any) => doctorController.updateAvailability(req, res));
router.post('/leave', staffGuard, (req: any, res: any) => doctorController.updateLeave(req, res));
router.post('/mark-leave', staffGuard, (req: any, res: any) => doctorController.markLeave(req, res));
router.get('/:id/activities', staffGuard, (req: any, res: any) => doctorController.getActivityLogs(req, res));

export default router;
