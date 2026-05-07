import { useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import { Doctor, Clinic, Patient, Appointment, PrescriptionPage } from '@kloqo/shared';
import { URLUtils } from '@kloqo/shared-core';

interface UsePrescriptionExportOptions {
  doctor: Doctor;
  clinic: Clinic;
  patient: Patient;
  appointment: Appointment;
  imageCacheRef: React.MutableRefObject<Map<string, HTMLImageElement>>;
}

export function usePrescriptionExport({
  doctor,
  clinic,
  patient,
  appointment,
  imageCacheRef
}: UsePrescriptionExportOptions) {
  
  const getFullBlob = useCallback(async (pages: PrescriptionPage[]): Promise<Blob | null> => {
    const A4_WIDTH = 1240;
    const A4_HEIGHT = 1754;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = A4_WIDTH;
    finalCanvas.height = A4_HEIGHT * pages.length;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return null;

    const exportOptions = {
      size: 3.5,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.85,
      simulatePressure: false,
    };

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      fctx.save();
      fctx.translate(0, i * A4_HEIGHT);

      // Draw Paper Background
      fctx.fillStyle = '#ffffff';
      fctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

      // 1. Draw Template (Letterhead + Patient Info)
      if (i === 0) {
        // Header Background - Diagonal Shape
        fctx.save();
        fctx.beginPath();
        fctx.moveTo(0, 0);
        fctx.lineTo(A4_WIDTH * 0.75, 0);
        fctx.lineTo(A4_WIDTH * 0.6375, 250);
        fctx.lineTo(0, 250);
        fctx.closePath();
        fctx.fillStyle = '#3ebfb2';
        fctx.fill();
        fctx.restore();

        // Doctor Info
        fctx.fillStyle = '#ffffff';
        fctx.font = 'bold 60px sans-serif';
        fctx.fillText(`Dr. ${doctor.name || 'Doctor'}`, 80, 110);
        
        fctx.font = 'bold 30px sans-serif';
        fctx.fillStyle = 'rgba(255,255,255,0.95)';
        fctx.fillText((doctor.department || 'OB/GYN').toUpperCase(), 80, 160);
        
        fctx.font = '500 22px sans-serif';
        fctx.fillStyle = 'rgba(255,255,255,0.85)';
        fctx.fillText((doctor.specialty || '').toUpperCase(), 80, 200);

        // Draw Kloqo logo
        try {
          const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = '/Kloqo_Logo_full (2) (1).webp';
            img.onload = () => resolve(img);
            img.onerror = reject;
          });
          const logoW = 280;
          const logoH = 100;
          const logoX = A4_WIDTH - logoW - 80;
          const logoY = (250 - logoH) / 2;
          fctx.drawImage(logo, logoX, logoY, logoW, logoH);
        } catch {}

        // Patient Grid
        fctx.fillStyle = '#f8fafc';
        fctx.fillRect(80, 260, A4_WIDTH - 160, 160);
        fctx.strokeStyle = '#e2e8f0';
        fctx.lineWidth = 1;
        fctx.strokeRect(80, 260, A4_WIDTH - 160, 160);

        fctx.fillStyle = '#64748b';
        fctx.font = 'bold 18px sans-serif';
        const labels = ['NAME:', 'DATE:', 'AGE:', 'CONTACT:', 'GENDER:', ''];
        const values = [
          patient.name,
          new Date().toLocaleDateString('en-GB'),
          `${patient.age ?? appointment.age ?? '-'}`,
          patient.communicationPhone || patient.phone || '-',
          patient.sex ?? (appointment as any).sex ?? '-',
          ''
        ];

        for (let j = 0; j < labels.length; j++) {
          if (!labels[j]) continue;
          const col = j % 2;
          const row = Math.floor(j / 2);
          const x = 120 + col * (A4_WIDTH / 2 - 60);
          const y = 300 + row * 45;
          fctx.fillText(labels[j], x, y);
          fctx.fillStyle = '#1e293b';
          fctx.font = 'bold 22px sans-serif';
          fctx.fillText(values[j], x + 120, y);
          fctx.fillStyle = '#64748b';
          fctx.font = 'bold 18px sans-serif';
        }

        // Rx Watermark
        fctx.fillStyle = 'rgba(241, 245, 249, 0.4)';
        fctx.font = '900 600px serif';
        fctx.textAlign = 'center';
        fctx.fillText('Rx', A4_WIDTH / 2, A4_HEIGHT * 0.6);
        fctx.textAlign = 'left';

        // Signature Area
        fctx.strokeStyle = '#334155';
        fctx.lineWidth = 2;
        fctx.beginPath();
        fctx.moveTo(A4_WIDTH - 380, A4_HEIGHT - 200);
        fctx.lineTo(A4_WIDTH - 100, A4_HEIGHT - 200);
        fctx.stroke();
        fctx.fillStyle = '#334155';
        fctx.font = 'bold 22px sans-serif';
        fctx.textAlign = 'center';
        fctx.fillText('Signature', A4_WIDTH - 240, A4_HEIGHT - 170);
        fctx.textAlign = 'left';

        // Footer
        const footerHeight = 120;
        fctx.fillStyle = '#ffffff';
        fctx.fillRect(0, A4_HEIGHT - footerHeight, A4_WIDTH, footerHeight);
        fctx.strokeStyle = '#e2e8f0';
        fctx.lineWidth = 2;
        fctx.beginPath();
        fctx.moveTo(80, A4_HEIGHT - footerHeight);
        fctx.lineTo(A4_WIDTH - 80, A4_HEIGHT - footerHeight);
        fctx.stroke();

        fctx.textAlign = 'center';
        fctx.fillStyle = '#0f172a';
        fctx.font = 'bold 24px sans-serif';
        fctx.fillText(clinic.name.toUpperCase(), A4_WIDTH / 2, A4_HEIGHT - 75);

        fctx.fillStyle = '#64748b';
        fctx.font = '500 18px sans-serif';
        let footerY = A4_HEIGHT - 45;
        if (clinic.address) {
          fctx.fillText(clinic.address, A4_WIDTH / 2, footerY);
          footerY += 25;
        }
        if (clinic.phone) {
          fctx.fillText(`Ph: ${clinic.phone}`, A4_WIDTH / 2, footerY);
        }
        fctx.textAlign = 'left';
      }

      if (page.backgroundUrl) {
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const cached = imageCacheRef.current.get(page.backgroundUrl!);
            if (cached && cached.complete) return resolve(cached);

            const image = new Image();
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const proxyUrl = URLUtils.getProxiedUrl(page.backgroundUrl!, API_URL);

            image.crossOrigin = 'anonymous';
            image.src = proxyUrl;
            image.onload = () => {
              imageCacheRef.current.set(page.backgroundUrl!, image);
              resolve(image);
            };
            image.onerror = () => reject(new Error("Failed to load background"));
          });
          fctx.drawImage(img, 0, 0, A4_WIDTH, A4_HEIGHT);
        } catch (err) {
          console.error("getFullBlob: Background error:", err);
        }
      }

      page.strokes.forEach(s => {
        const scaleX = A4_WIDTH / (s.canvasWidth || 1);
        const scaleY = A4_HEIGHT / (s.canvasHeight || 1);
        const avgScale = (scaleX + scaleY) / 2;
        const scaledPoints = s.points.map(([x, y, p]) => [x * scaleX, y * scaleY, p]);
        const outlinePoints = getStroke(scaledPoints, {
          ...exportOptions,
          size: exportOptions.size * avgScale,
        });
        
        if (!outlinePoints.length) return;
        fctx!.fillStyle = '#1e1b4b';
        fctx!.beginPath();
        outlinePoints.forEach(([x, y], idx) => {
          if (idx === 0) fctx!.moveTo(x, y);
          else fctx!.lineTo(x, y);
        });
        fctx!.closePath();
        fctx!.fill();
      });

      if (page.text) {
        // We need a way to know the original canvas width for text scaling
        // For now, assume a standard width or pass it in
        const scaleY = A4_HEIGHT / 1000; // rough estimate
        fctx.fillStyle = '#1e1b4b';
        fctx.font = `500 ${Math.round(24 * scaleY)}px sans-serif`;
        const lines = page.text.split('\n');
        lines.forEach((line, idx) => {
          fctx.fillText(line, 80 * scaleY, 420 * scaleY + (idx * 36 * scaleY));
        });
      }

      fctx.restore();
    }

    return new Promise((resolve, reject) => {
      try {
        finalCanvas.toBlob(blob => resolve(blob), 'image/png');
      } catch (err) {
        console.error("getFullBlob: Security Error", err);
        reject(new Error("CANVAS_TAINTED"));
      }
    });
  }, [doctor, clinic, patient, appointment, imageCacheRef]);

  const getInkBlob = useCallback(async (pages: PrescriptionPage[]): Promise<Blob | null> => {
    const A4_WIDTH = 1240;
    const A4_HEIGHT = 1754;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = A4_WIDTH;
    finalCanvas.height = A4_HEIGHT * pages.length;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return null;

    const exportOptions = {
      size: 3.5,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.85,
      simulatePressure: false,
    };

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      fctx.save();
      fctx.translate(0, i * A4_HEIGHT);

      if (page.backgroundUrl) {
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const cached = imageCacheRef.current.get(page.backgroundUrl!);
            if (cached && cached.complete) return resolve(cached);

            const image = new Image();
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const proxyUrl = URLUtils.getProxiedUrl(page.backgroundUrl!, API_URL);

            image.crossOrigin = 'anonymous';
            image.src = proxyUrl;
            image.onload = () => {
              imageCacheRef.current.set(page.backgroundUrl!, image);
              resolve(image);
            };
            image.onerror = () => reject(new Error("Failed to load ink background"));
          });
          fctx.drawImage(img, 0, 0, A4_WIDTH, A4_HEIGHT);
        } catch {}
      }

      page.strokes.forEach(s => {
        const scaleX = A4_WIDTH / (s.canvasWidth || 1);
        const scaleY = A4_HEIGHT / (s.canvasHeight || 1);
        const avgScale = (scaleX + scaleY) / 2;
        const scaledPoints = s.points.map(([x, y, p]) => [x * scaleX, y * scaleY, p]);
        const outlinePoints = getStroke(scaledPoints, {
          ...exportOptions,
          size: exportOptions.size * avgScale,
        });
        
        if (!outlinePoints.length) return;
        fctx!.fillStyle = '#1e1b4b';
        fctx!.beginPath();
        outlinePoints.forEach(([x, y], idx) => {
          if (idx === 0) fctx!.moveTo(x, y);
          else fctx!.lineTo(x, y);
        });
        fctx!.closePath();
        fctx!.fill();
      });

      if (page.text) {
        const scaleY = A4_HEIGHT / 1000;
        fctx.fillStyle = '#1e1b4b';
        fctx.font = `500 ${Math.round(24 * scaleY)}px sans-serif`;
        const lines = page.text.split('\n');
        lines.forEach((line, idx) => {
          fctx.fillText(line, 80 * scaleY, 420 * scaleY + (idx * 36 * scaleY));
        });
      }

      fctx.restore();
    }

    return new Promise((resolve, reject) => {
      try {
        finalCanvas.toBlob(blob => resolve(blob), 'image/png');
      } catch (err) {
        console.error("getInkBlob: Security Error", err);
        reject(new Error("CANVAS_TAINTED"));
      }
    });
  }, [imageCacheRef]);

  return { getFullBlob, getInkBlob };
}
