import { Router } from 'express';
import { container } from '../../infrastructure/webserver/express/Container';
import { createMiddleware } from '../../infrastructure/webserver/express/middleware';
import { Role } from '@kloqo/shared';

const router = Router();
const { auth, checkRole } = createMiddleware(container.verifySessionUseCase);
const { clinicController, analyticsController, doctorController, userController,
        departmentController, appointmentController, patientController,
        prescriptionController } = container;

const clinicStaffRoles: Role[] = ['clinicAdmin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'superAdmin'];
const adminOnlyRoles: Role[] = ['clinicAdmin', 'superAdmin'];

const staffGuard = [auth, checkRole(...clinicStaffRoles)];
const adminGuard = [auth, checkRole(...adminOnlyRoles)];

// ── Authenticated clinic-scoped endpoints (all apps) ──────────────────────
// IMPORTANT: These MUST be defined BEFORE the parameterized /:id route below
// to prevent shadowing (Express matches routes in order of definition).
router.get('/me', staffGuard, (req: any, res: any) => clinicController.getMyClinic(req, res));
router.get('/dashboard', adminGuard, (req: any, res: any) => analyticsController.getClinicDashboard(req, res));
router.get('/providers/performance', adminGuard, (req: any, res: any) => analyticsController.getProviderPerformance(req, res));
router.patch('/', adminGuard, (req: any, res: any) => clinicController.updateMyClinic(req, res));
router.patch('/settings', adminGuard, (req: any, res: any) => clinicController.updateSettings(req, res));
router.patch('/whatsapp', adminGuard, (req: any, res: any) => clinicController.updateWhatsappConfig(req, res));
router.post('/whatsapp/generate-code', adminGuard, (req: any, res: any) => clinicController.generateShortCode(req, res));
router.post('/sync-status', staffGuard, (req: any, res: any) => clinicController.syncStatus(req, res));

// ── Patients ───────────────────────────────────────────────────────────────
router.get('/patients', staffGuard, (req: any, res: any) => patientController.getMyClinicPatients(req, res));
router.get('/patients/:id/history', staffGuard, (req: any, res: any) => patientController.getPatientHistory(req, res));

// ── Staff (admin only) ─────────────────────────────────────────────────────
router.get('/staff', adminGuard, (req: any, res: any) => userController.getAllUsers(req, res));
router.post('/staff', adminGuard, (req: any, res: any) => userController.saveUser(req, res));
router.patch('/staff/:id/roles', adminGuard, (req: any, res: any) => userController.updateUser(req, res));
router.delete('/staff/:id', adminGuard, (req: any, res: any) => userController.deleteUser(req, res));

// ── Doctors ────────────────────────────────────────────────────────────────
router.get('/doctors', staffGuard, (req: any, res: any) => doctorController.getAllDoctors(req, res));
router.post('/doctors', adminGuard, (req: any, res: any) => doctorController.saveDoctor(req, res));
router.put('/doctors/:id/access', adminGuard, (req: any, res: any) => doctorController.updateDoctorAccess(req, res));
router.delete('/doctors/:id/access', adminGuard, (req: any, res: any) => doctorController.revokeDoctorAccess(req, res));

// ── Appointments ───────────────────────────────────────────────────────────
router.get('/appointments', staffGuard, (req: any, res: any) => appointmentController.getClinicAppointments(req, res));

// ── Departments master list ────────────────────────────────────────────────
router.get('/departments/master', staffGuard, (req: any, res: any) => departmentController.getAllDepartments(req, res));

// ── Prescriptions ──────────────────────────────────────────────────────────
router.get('/prescriptions', staffGuard, (req: any, res: any) => prescriptionController.getByClinicFiltered(req, res));
router.get('/prescriptions/stats', adminGuard, (req: any, res: any) => prescriptionController.getClinicStats(req, res));

// ── Departments Discovery ────────────────────────────────────────────────
router.get('/departments', (req, res) => departmentController.getAllDepartments(req, res));
 
// ── Public clinic discovery (patient-app) ──────────────────────────────────
// IMPORTANT: ID routes MUST come after specific static routes
router.get('/', (req, res) => clinicController.getAllClinics(req, res));
router.get('/:id', (req, res) => clinicController.getClinic(req, res));
router.get('/:id/doctors', (req, res) => {
  req.query.clinicId = req.params.id;
  return doctorController.getAllDoctors(req, res);
});

export default router;
