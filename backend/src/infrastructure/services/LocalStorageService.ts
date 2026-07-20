/**
 * LocalStorageService.ts
 *
 * On-Premise disk storage adapter for Standalone Kloqo deployments.
 *
 * When IS_LOCAL_STANDALONE=true, this service handles all file uploads
 * by writing files to the local hard drive (./uploads/) instead of
 * Firebase Cloud Storage. The Express server then serves these files
 * as static assets over the local network, allowing both the clinic
 * and the pharmacy (connected via Tailscale) to view prescription
 * documents, doctor avatars, and clinic logos.
 *
 * File structure on local disk:
 *   ./uploads/
 *     logos/         ← Clinic logos & doctor avatars
 *     prescriptions/ ← Prescription PDFs
 *     misc/          ← Any other uploaded files
 */

import fs from 'fs';
import path from 'path';
import multer, { StorageEngine } from 'multer';

// ── Local Upload Root ──────────────────────────────────────────────────────
// Files are stored relative to the backend working directory.
const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

// Ensure all required subdirectories exist at startup.
const UPLOAD_SUBDIRS = ['logos', 'prescriptions', 'misc'];
UPLOAD_SUBDIRS.forEach((dir) => {
  const fullPath = path.join(UPLOADS_ROOT, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`[LocalStorageService] Created upload directory: ${fullPath}`);
  }
});

// ── Multer Storage Engine ─────────────────────────────────────────────────
const diskStorage: StorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine the target subdirectory based on a custom field in the request.
    // Defaults to 'misc' if not explicitly specified.
    const subdir = (req as any).uploadSubdir ?? 'misc';
    const destPath = path.join(UPLOADS_ROOT, subdir);
    cb(null, destPath);
  },
  filename: (_req, file, cb) => {
    // Build a unique file name: <timestamp>-<sanitised-original-name>
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniqueName = `${Date.now()}-${safeOriginalName}`;
    cb(null, uniqueName);
  },
});

// ── Multer Instance ───────────────────────────────────────────────────────
export const localUpload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max upload size
  },
  fileFilter: (_req, file, cb) => {
    // Allow images and PDFs only
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Only images and PDFs are allowed.`));
    }
  },
});

// ── URL Builder ───────────────────────────────────────────────────────────
/**
 * buildLocalFileUrl
 *
 * Constructs the URL that the clinic / pharmacy frontend will use to load
 * the uploaded file from the local Express server over the LAN or Tailscale tunnel.
 *
 * Example:
 *   subdir  = 'prescriptions'
 *   filename = '1721456789123-prescription.pdf'
 *   → 'http://192.168.1.10:3001/uploads/prescriptions/1721456789123-prescription.pdf'
 *
 * Uses BACKEND_BASE_URL from .env (e.g. http://100.x.y.z:3001 for Tailscale).
 */
export function buildLocalFileUrl(subdir: string, filename: string): string {
  const base = process.env.BACKEND_BASE_URL || 'http://localhost:3001';
  return `${base}/uploads/${subdir}/${filename}`;
}

// ── File Deletion Helper ──────────────────────────────────────────────────
/**
 * deleteLocalFile
 *
 * Safely deletes a file from the local uploads directory.
 * Silently ignores missing files (idempotent).
 */
export function deleteLocalFile(subdir: string, filename: string): void {
  try {
    const filePath = path.join(UPLOADS_ROOT, subdir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[LocalStorageService] Deleted file: ${filePath}`);
    }
  } catch (err) {
    console.error(`[LocalStorageService] Failed to delete file ${subdir}/${filename}:`, err);
  }
}

export const UPLOADS_ROOT_PATH = UPLOADS_ROOT;
