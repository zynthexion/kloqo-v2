import { Router } from 'express';
import { container } from '../../infrastructure/webserver/express/Container';
import { createMiddleware } from '../../infrastructure/webserver/express/middleware';

const router = Router();
const { auth } = createMiddleware(container.verifySessionUseCase);
const { authController, patientController } = container;

// ── Public auth endpoints ──────────────────────────────────────────────────
router.get(['/check-email', '/api/auth/check-email'], (req: any, res: any) => authController.checkEmail(req, res));
router.post(['/send-otp', '/api/auth/send-otp'], (req: any, res: any) => authController.sendOtp(req, res));
router.post(['/verify-otp', '/api/auth/verify-otp'], (req: any, res: any) => authController.verifyOtp(req, res));
router.post(['/reset-password', '/api/auth/reset-password'], (req: any, res: any) => authController.resetPassword(req, res));
router.post(['/login', '/api/auth/login'], (req: any, res: any) => authController.login(req, res));
router.post(['/register', '/api/auth/register'], (req: any, res: any) => authController.register(req, res));
router.post(['/register-superadmin', '/api/auth/register-superadmin'], (req: any, res: any) => container.userController.registerInitialAdmin(req, res));
router.post(['/force-reset', '/api/auth/force-reset'], (req: any, res: any) => authController.forceReset(req, res));
router.get(['/me', '/api/auth/me'], (req: any, res: any) => authController.me(req, res));

// ── Patient sync (called by patient-app on first load) ─────────────────────
router.post(['/patient/sync', '/api/auth/patient/sync'], (req: any, res: any) => patientController.syncAuth(req, res));

// ── Authenticated profile / password endpoints ─────────────────────────────
router.patch(['/profile', '/api/auth/profile'], auth, (req: any, res: any) => authController.updateProfile(req, res));
router.post(['/change-password', '/api/auth/change-password'], auth, (req: any, res: any) => authController.changePassword(req, res));

export default router;
