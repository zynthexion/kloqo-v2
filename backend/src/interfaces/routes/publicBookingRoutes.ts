import { Router } from 'express';
import { container } from '../../infrastructure/webserver/express/Container';

const router = Router();
const { publicBookingController } = container;

/**
 * RESTRICTED PUBLIC ROUTE
 * This is the ONLY unauthenticated endpoint for the patient booking flow.
 * It returns minimal, scrubbed data.
 */
router.get('/clinics', (req, res) => publicBookingController.getClinics(req, res));
router.get('/clinics/:clinicId', (req, res) => publicBookingController.getBookingContext(req, res));
router.get('/doctors/:doctorId', (req, res) => publicBookingController.getDoctor(req, res));
router.get('/doctors/:doctorId/slots', (req, res) => publicBookingController.getAvailableSlots(req, res));
router.get('/doctors/:doctorId/slots/check', (req, res) => publicBookingController.checkSlotAvailability(req, res));
router.get('/clinics/:clinicId/doctors/:doctorId/queue', (req, res) => publicBookingController.getQueueStatus(req, res));

export default router;
