import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

export function verifyWhatsAppSignature(req: Request, res: Response, next: NextFunction) {
  const signatureHeader = req.headers['x-hub-signature-256'] as string;
  
  if (!signatureHeader) {
    console.error('Missing x-hub-signature-256 header');
    return res.status(401).send('Unauthorized');
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error('WHATSAPP_APP_SECRET is not configured');
    return res.status(500).send('Server Configuration Error');
  }

  // The request MUST be parsed as raw using `express.raw({ type: '*/*' })` prior to this
  if (!Buffer.isBuffer(req.body)) {
    console.error('Request body is not a Buffer. Ensure express.raw() is used.');
    return res.status(500).send('Server Configuration Error');
  }

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(req.body)
    .digest('hex')}`;

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature))) {
      console.error('Invalid WhatsApp Webhook Signature');
      return res.status(401).send('Unauthorized');
    }
  } catch (error) {
    return res.status(401).send('Unauthorized');
  }

  // Parse the verified body to JSON for the next handler
  try {
    req.body = JSON.parse(req.body.toString('utf-8'));
  } catch (e) {
    return res.status(400).send('Invalid JSON body');
  }

  next();
}
