import { Request, Response, NextFunction } from 'express';

export const cronAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.error('SERVER CONFIG ERROR: CRON_SECRET is not defined in environment variables.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const requestedSecret = req.headers['x-cron-secret'];

  if (!requestedSecret || requestedSecret !== cronSecret) {
    console.warn(`Unauthorized cron access attempt from IP: ${req.ip}`);
    return res.status(403).json({ error: 'Unauthorized: Invalid or missing cron secret.' });
  }

  next();
};
