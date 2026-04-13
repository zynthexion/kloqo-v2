import { Router } from 'express';
import { container } from '../../infrastructure/webserver/express/Container';
import { createMiddleware } from '../../infrastructure/webserver/express/middleware';

import { Role } from '@kloqo/shared';

const router = Router();
const { auth, checkRole, checkPermission } = createMiddleware(container.verifySessionUseCase);
const { appointmentController, analyticsController, clinicController, doctorController,
        patientController, userController, departmentController, notificationController,
        prescriptionController, settingsController, superAdminController } = container;

const superadminGuard = [auth, checkRole('superAdmin' as Role)];

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get('/dashboard', ...superadminGuard, checkPermission('Dashboard'), (req, res) => analyticsController.getDashboard(req, res));
router.get('/investor-metrics', ...superadminGuard, async (req, res) => {
  try {
    const [mrr, activeCount, allAppts] = await Promise.all([
      container.subscriptionRepo.sumMRR(),
      container.subscriptionRepo.countByStatus('active'),
      container.appointmentRepo.findCompletedByClinic('', { pharmacyStatus: 'dispensed' }).catch(() => [] as any[]),
    ]);
    const gmvRouted = (allAppts || []).reduce((sum: number, a: any) => sum + (a.dispensedValue || 0), 0);
    res.json({ mrr, arr: mrr * 12, activeSubscriptions: activeCount, gmvRouted });
  } catch {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Clinics ────────────────────────────────────────────────────────────────
router.post('/clinics/status', ...superadminGuard, checkPermission('Clinics'), (req, res) => clinicController.updateClinicStatus(req, res));
router.get('/clinics', ...superadminGuard, checkPermission('Clinics'), (req, res) => clinicController.getAllClinics(req, res));
router.post('/clinics', ...superadminGuard, checkPermission('Clinics'), (req, res) => clinicController.saveClinic(req, res));
router.get('/clinics/:id', ...superadminGuard, checkPermission('Clinics'), (req, res) => clinicController.getClinic(req, res));
router.patch('/clinics/:id', ...superadminGuard, checkPermission('Clinics'), (req, res) => clinicController.updateClinic(req, res));
router.delete('/clinics/:id', ...superadminGuard, checkPermission('Clinics'), (req, res) => clinicController.deleteClinic(req, res));

// ── Doctors ────────────────────────────────────────────────────────────────
router.get('/doctors', ...superadminGuard, (req, res) => doctorController.getAllDoctors(req, res));
router.post('/doctors', ...superadminGuard, (req, res) => doctorController.saveDoctor(req, res));
router.get('/doctors/:id', ...superadminGuard, (req, res) => doctorController.getDoctor(req, res));
router.delete('/doctors/:id', ...superadminGuard, (req, res) => doctorController.deleteDoctor(req, res));

// ── Patients, Users & Appointments ────────────────────────────────────────
router.get('/appointments', ...superadminGuard, checkPermission('Patients'), (req, res) => appointmentController.getAllAppointments(req, res));
router.get('/patients', ...superadminGuard, checkPermission('Patients'), (req, res) => patientController.getAllPatients(req, res));
router.get('/users', ...superadminGuard, checkPermission('Staff'), (req, res) => userController.getAllUsers(req, res));
router.post('/users', ...superadminGuard, checkPermission('Staff'), (req, res) => userController.saveUser(req, res));
router.post('/users/invite', ...superadminGuard, checkPermission('Staff'), (req, res) => userController.inviteStaff(req, res));

// ── Settings ───────────────────────────────────────────────────────────────
router.get('/settings', ...superadminGuard, (req, res) => settingsController.getGlobalSettings(req, res));
router.post('/settings', ...superadminGuard, (req, res) => settingsController.updateGlobalSettings(req, res));

// ── Departments ────────────────────────────────────────────────────────────
router.get('/departments', ...superadminGuard, (req, res) => departmentController.getAllDepartments(req, res));
router.post('/departments', ...superadminGuard, (req, res) => departmentController.saveDepartment(req, res));
router.patch('/departments/:id', ...superadminGuard, (req, res) => departmentController.updateDepartment(req, res));
router.delete('/departments/:id', ...superadminGuard, (req, res) => departmentController.deleteDepartment(req, res));

// ── Analytics ──────────────────────────────────────────────────────────────
router.get('/punctuality', ...superadminGuard, (req, res) => analyticsController.getPunctualityLogs(req, res));
router.get('/errors', ...superadminGuard, (req, res) => analyticsController.getErrorLogs(req, res));

// ── Notifications ──────────────────────────────────────────────────────────
router.get('/notifications/configs', ...superadminGuard, (req, res) => notificationController.getConfigs(req, res));
router.patch('/notifications/configs/:id', ...superadminGuard, (req, res) => notificationController.updateConfig(req, res));
router.post('/notifications/configs/reset', ...superadminGuard, (req, res) => notificationController.resetConfigs(req, res));

// ── Impersonation (God Mode) ───────────────────────────────────────────────
router.post('/impersonate/:clinicId', ...superadminGuard, (req, res) => superAdminController.impersonate(req, res));

export default router;
