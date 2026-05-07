import { Request, Response } from 'express';

export class UtilityController {
  async proxyImage(req: Request, res: Response) {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL query parameter is required' });
    }

    // SECURITY: Validate that the URL is an authorized source (Rule 15)
    // Only allow proxying for our Firebase/GCS Storage buckets
    const isAuthorized = 
      url.startsWith('https://firebasestorage.googleapis.com') || 
      url.startsWith('https://storage.googleapis.com');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: Unauthorized proxy target' });
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      // Explicitly allow CORS for this proxied response
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (error: any) {
      console.error('Image Proxy Error:', error);
      res.status(500).json({ error: 'Failed to proxy image', details: error.message });
    }
  }
}
