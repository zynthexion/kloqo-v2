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
import * as dotenv from 'dotenv';

// Use absolute path to ensure .env is found when running from monorepo root
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

// ── Route Modules ──────────────────────────────────────────────────────────
import authRoutes from '../../../interfaces/routes/authRoutes';
import appointmentRoutes from '../../../interfaces/routes/appointmentRoutes';
import clinicRoutes from '../../../interfaces/routes/clinicRoutes';
import doctorRoutes from '../../../interfaces/routes/doctorRoutes';
import patientRoutes from '../../../interfaces/routes/patientRoutes';
import superadminRoutes from '../../../interfaces/routes/superadminRoutes';
import miscRoutes from '../../../interfaces/routes/miscRoutes';
import publicBookingRoutes from '../../../interfaces/routes/publicBookingRoutes';

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
    
    // Auto-allow local network IPs in development for iPad testing
    const isLocalIP = origin.startsWith('http://192.168.') || origin.startsWith('http://10.') || origin.startsWith('http://172.');

    if (isAllowed || isLocalIP) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from origin: ${origin}`);
      // Returning null, false tells CORS to block the request without throwing a 500 error
      callback(null, false);
    }
  },
  credentials: false // Using Bearer tokens, not cookies
}));
app.use(express.json());

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '2.0.0' }));

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
