import { Router } from 'express';
import { container } from '../../infrastructure/webserver/express/Container';
import { createMiddleware } from '../../infrastructure/webserver/express/middleware';

import { Role, KLOQO_ROLES } from '@kloqo/shared';

const router = Router();
const { auth, checkRole } = createMiddleware(container.verifySessionUseCase);
const { patientController } = container;

const { CLINIC_ADMIN, DOCTOR, NURSE, RECEPTIONIST, PHARMACIST, SUPER_ADMIN, PATIENT } = KLOQO_ROLES;
const clinicStaffRoles: Role[] = [CLINIC_ADMIN, DOCTOR, NURSE, RECEPTIONIST, PHARMACIST, SUPER_ADMIN];
const staffGuard = [auth, checkRole(...clinicStaffRoles)];
const anyRoleGuard = [auth, checkRole(...clinicStaffRoles, PATIENT)];

// ── Public patient profile & discovery ────────────────────────────────────
router.get('/profile', (req: any, res: any) => patientController.getPatientProfile(req, res));
router.get('/public', (req: any, res: any) => patientController.getPublicDiscovery(req, res));

// ── Authenticated patient routes ───────────────────────────────────────────
router.get('/search', staffGuard, (req: any, res: any) => patientController.searchPatients(req, res));
router.get('/link-pending', staffGuard, (req: any, res: any) => patientController.getLinkPending(req, res));
router.post('/manage', staffGuard, (req: any, res: any) => patientController.managePatient(req, res));
router.post('/add-relative', staffGuard, (req: any, res: any) => patientController.addRelative(req, res));
router.post('/unlink-relative', staffGuard, (req: any, res: any) => patientController.unlinkRelative(req, res));
router.get('/me/appointments', anyRoleGuard, (req: any, res: any) => patientController.getMyAppointments(req, res));

export default router;
