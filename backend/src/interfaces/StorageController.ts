import { Request, Response } from 'express';
import { storage } from '../infrastructure/firebase/config';

export class StorageController {
  async upload(req: Request, res: Response) {
    try {
      const file = req.file;
      const { userId, documentType } = req.body;

      if (!file || !userId || !documentType) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          received: { hasFile: !!file, hasUserId: !!userId, hasDocumentType: !!documentType }
        });
      }

      // Validate document type
      const validTypes = ['logo', 'license', 'reception_photo', 'profile_photo'];
      if (!validTypes.includes(documentType)) {
        return res.status(400).json({ 
          error: 'Invalid document type.' 
        });
      }

      const bucket = storage.bucket(); // Uses default bucket from initializeApp
      const filePath = `clinics/${userId}/documents/${documentType}_${Date.now()}_${file.originalname}`;
      const fileRef = bucket.file(filePath);

      await fileRef.save(file.buffer, {
        contentType: file.mimetype,
        metadata: {
          uploadedBy: userId,
          documentType: documentType,
        },
      });

      // Make the file publicly accessible
      await fileRef.makePublic();
      
      // Get the public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

      return res.json({
        url: publicUrl,
        filePath: filePath,
        documentType: documentType
      });

    } catch (error: any) {
      console.error('Backend Upload Error:', error);
      return res.status(500).json({
        error: 'Upload failed',
        message: error.message
      });
    }
  }
}
