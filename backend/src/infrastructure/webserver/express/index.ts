/**
 * Kloqo V2 Backend — Express Server Entrypoint
 *
 * This file is intentionally minimal. Its only jobs are:
 *   1. Create and configure the Express application
 *   2. Mount modular route files
 *   3. Register the global error handler
 *   4. Start the server
 *
 * All dependency wiring lives in:   ./Container.ts
 * All middleware logic lives in:    ./middleware.ts
 * All route definitions live in:    src/interfaces/routes/
 */
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';

// Use absolute path to ensure .env is found when running from monorepo root
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

import { IS_LOCAL_STANDALONE } from '../../firebase/config';
import { UPLOADS_ROOT_PATH } from '../../services/LocalStorageService';
import { createLicenseMiddleware } from './middleware';
import { LicenseHeartbeatService } from '../../../domain/services/LicenseHeartbeatService';
import { container } from './Container';

// ── Route Modules ──────────────────────────────────────────────────────────
import authRoutes from '../../../interfaces/routes/authRoutes';
import appointmentRoutes from '../../../interfaces/routes/appointmentRoutes';
import clinicRoutes from '../../../interfaces/routes/clinicRoutes';
import doctorRoutes from '../../../interfaces/routes/doctorRoutes';
import patientRoutes from '../../../interfaces/routes/patientRoutes';
import superadminRoutes from '../../../interfaces/routes/superadminRoutes';
import miscRoutes from '../../../interfaces/routes/miscRoutes';
import publicBookingRoutes from '../../../interfaces/routes/publicBookingRoutes';
import conflictRoutes from '../../../interfaces/routes/conflictRoutes';

// ── Application Setup ──────────────────────────────────────────────────────
const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(helmet());
app.use(morgan('dev'));

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
  : ['*'];

console.log('🌐 CORS Allowed Origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*');
    
    // Auto-allow local network IPs and tunnel domains for testing
    const isLocalIP = origin.startsWith('http://192.168.') || origin.startsWith('http://10.') || origin.startsWith('http://172.');
    const isTunnel = origin.includes('.ngrok-free.app') || 
                     origin.includes('.ngrok-free.dev') || 
                     origin.includes('.loca.lt') || 
                     origin.includes('.trycloudflare.com') ||
                     origin.includes('localhost');

    if (isAllowed || isLocalIP || isTunnel) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'ngrok-skip-browser-warning']
}));
app.use(cookieParser());
app.use(express.json());

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({
  status: 'ok',
  version: '2.0.0',
  mode: IS_LOCAL_STANDALONE ? 'local-standalone' : 'cloud-saas'
}));

// ── Local Standalone: Static File Serving ──────────────────────────────────
// In local standalone mode, uploaded files (prescriptions, logos, avatars) are
// written to the local disk and served over the LAN / Tailscale mesh network.
// The pharmacy PC loads prescription PDFs from this URL path.
if (IS_LOCAL_STANDALONE) {
  app.use('/uploads', express.static(UPLOADS_ROOT_PATH));
  console.log(`📁 [LOCAL STANDALONE] Serving local uploads from: ${UPLOADS_ROOT_PATH}`);
  console.log(`💡 Pharmacy & Doctor PCs can access files at: <your-local-ip>:${Number(process.env.PORT) || 3001}/uploads/`);
}

// ── Local Standalone: SaaS License Enforcement ─────────────────────────────
// When running as on-premise software, a 24-hour license heartbeat checks the
// clinic's monthly subscription with api.kloqo.com. Requests are blocked
// (HTTP 402) if the subscription has been expired for more than 7 days.
if (IS_LOCAL_STANDALONE) {
  const clinicId = process.env.LOCAL_CLINIC_ID || '';
  if (!clinicId) {
    console.warn('[LOCAL STANDALONE] ⚠️  LOCAL_CLINIC_ID is not set in .env. License enforcement will be skipped.');
  } else {
    const heartbeatService = new LicenseHeartbeatService(container.subscriptionRepo, clinicId);
    heartbeatService.start().catch((err) => {
      console.error('[LOCAL STANDALONE] License heartbeat failed to start:', err.message);
    });
    // Apply license middleware globally (before all routes)
    const verifyLicense = createLicenseMiddleware(heartbeatService);
    app.use(verifyLicense);
    console.log('🔐 [LOCAL STANDALONE] SaaS license middleware is active.');
  }
}

// ── Route Mounting ─────────────────────────────────────────────────────────
// Auth routes are mounted at both /auth and /api/auth for backward compat
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

// Appointment routes at /appointments and /api/appointments
app.use('/appointments', appointmentRoutes);
app.use('/api/appointments', appointmentRoutes);

// Clinic routes at /clinic and /clinics
app.use('/clinic', clinicRoutes);
app.use('/clinics', clinicRoutes);
app.use('/api/clinics', clinicRoutes);

// Doctor routes at /doctors and /api/doctors
app.use('/doctors', doctorRoutes);
app.use('/api/doctors', doctorRoutes);

// Patient routes at /patients and /api/patients
app.use('/patients', patientRoutes);
app.use('/api/patients', patientRoutes);
app.use('/discovery', patientRoutes);
app.use('/api/discovery', patientRoutes);

// Superadmin routes (guarded by authenticateToken + checkRole('superAdmin'))
app.use('/superadmin', superadminRoutes);

// Misc: breaks, prescriptions, storage, payments, webhooks, SSE, FCM, logging
app.use('/', miscRoutes);

// Public Booking routes (unauthenticated)
app.use('/public-booking', publicBookingRoutes);
app.use('/api/public-booking', publicBookingRoutes);
// Conflict routes
app.use('/conflicts', conflictRoutes);
app.use('/api/conflicts', conflictRoutes);

// ── Local Standalone: System Endpoints ─────────────────────────────────────
// These endpoints are only active in standalone local mode and are used for
// initial setup and subscription syncing. They bypass the license middleware.
if (IS_LOCAL_STANDALONE) {
  /**
   * POST /api/v1/system/seed-local
   * Body: { pairingToken: string }
   *
   * One-time endpoint called during initial clinic setup.
   * Downloads all clinic/doctor/department/user data from the Kloqo Cloud
   * and writes it into the local Firestore Emulator.
   */
  app.post('/api/v1/system/seed-local', async (req, res) => {
    try {
      const { pairingToken } = req.body;
      if (!pairingToken) {
        return res.status(400).json({ error: 'pairingToken is required in the request body.' });
      }
      const result = await container.seedLocalClinicDataUseCase.execute(pairingToken);
      return res.json(result);
    } catch (err: any) {
      console.error('[Seed] Seed failed:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/v1/system/status
   *
   * Returns the current local system status including mode, version,
   * and subscription validity. Useful for the clinic's system admin.
   */
  app.get('/api/v1/system/status', (_req, res) => {
    res.json({
      mode: 'local-standalone',
      version: '2.0.0',
      clinicId: process.env.LOCAL_CLINIC_ID || 'not-configured',
      uploadsPath: UPLOADS_ROOT_PATH,
      timestamp: new Date().toISOString(),
    });
  });

  console.log('🛠️  [LOCAL STANDALONE] System endpoints mounted at /api/v1/system/');
}


// ── Global Error Handler ───────────────────────────────────────────────────
// Must be the LAST middleware registered (Express rule for 4-arg handlers).
// Prevents raw error stacks from ever reaching clients.
app.use((err: any, req: any, res: any, _next: any) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.stack || err.message);
  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : err.message,
    code: err.code || 'INTERNAL_ERROR',
  });
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Kloqo V2 Backend listening at http://0.0.0.0:${port}`);
  console.log(`📡 Ready for traffic on ${process.env.ALLOWED_ORIGINS || 'ALL ORIGINS'}`);
});

export default app;
