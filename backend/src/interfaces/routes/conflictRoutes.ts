import { Router } from 'express';
import { container } from '../../infrastructure/webserver/express/Container';
import { createMiddleware } from '../../infrastructure/webserver/express/middleware';

const router = Router();
const { auth } = createMiddleware(container.verifySessionUseCase);

/**
 * GET /conflicts/pending
 * Fetches all pending conflicts for the clinic.
 */
router.get('/pending', auth, (req, res) => container.conflictController.getPendingConflicts(req, res));

/**
 * POST /conflicts/:id/resolve
 * Resolves a specific conflict.
 */
router.post('/:id/resolve', auth, (req, res) => container.conflictController.resolveConflict(req, res));

export default router;
