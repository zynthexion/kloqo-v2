'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import { Doctor, Clinic, Patient, Appointment } from '@kloqo/shared';

interface Stroke {
  points: number[][];
  color: string;
  width: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface PageData {
  strokes: Stroke[];
  text?: string;
  backgroundUrl?: string;
}

interface UsePrescriptionDrawingOptions {
  doctor: Doctor;
  clinic: Clinic;
  patient: Patient;
  appointment: Appointment;
}

export function usePrescriptionDrawing({
  doctor,
  clinic,
  patient,
  appointment,
}: UsePrescriptionDrawingOptions) {
  // SINGLE CANVAS — No race conditions possible
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Silent drawing state — never touches React
  const currentStrokeRef = useRef<number[][]>([]);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Refs that mirror React state — lets event handlers read current values
  // without being stale closures or triggering effect re-runs
  const pagesRef = useRef<PageData[]>([{ strokes: [] }]);
  const currentPageIndexRef = useRef(0);

  // React state — only used for UI sync and export
  const [pages, setPages] = useState<PageData[]>([{ strokes: [] }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Keep refs in sync with state
  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { currentPageIndexRef.current = currentPageIndex; }, [currentPageIndex]);

  // Pressure to dot radius — Apple Pencil range
  const pressureToRadius = (pressure: number) =>
    0.4 + (pressure || 0.5) * 1.0;

  // REDRAW PAGE — reads from refs, has zero React dependencies
  // Safe to call anytime without triggering re-render chains
  const redrawPage = useCallback((pageIndex?: number) => {
    // Never interrupt an active stroke
    if (isDrawingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const idx = pageIndex ?? currentPageIndexRef.current;
    const page = pagesRef.current[idx];
    const strokes = page?.strokes ?? [];
    const backgroundUrl = page?.backgroundUrl;

    const draw = () => {
      // 1. Draw Strokes
      strokes.forEach(stroke => {
        const pts = stroke.points;
        if (pts.length < 1) return;

        ctx.fillStyle = '#1e1b4b';
        for (let i = 0; i < pts.length; i++) {
          const [x, y, p] = pts[i];
          const r = pressureToRadius(p);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();

          if (i > 0) {
            const prev = pts[i - 1];
            const dist = Math.hypot(x - prev[0], y - prev[1]);
            const steps = Math.ceil(dist / (r * 0.5));
            for (let s = 1; s < steps; s++) {
              const t = s / steps;
              const ix = prev[0] + (x - prev[0]) * t;
              const iy = prev[1] + (y - prev[1]) * t;
              const ir = pressureToRadius(prev[2] + (p - prev[2]) * t);
              ctx.beginPath();
              ctx.arc(ix, iy, ir, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      });
    };

    if (backgroundUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = backgroundUrl;
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
        draw();
      };
    } else {
      draw();
    }
  }, []);

  // SETUP CANVAS — Configure DPR scaling
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const targetWidth = Math.floor(rect.width * dpr);
    const targetHeight = Math.floor(rect.height * dpr);

    // Only reset if dimensions actually changed
    if (canvas.width === targetWidth && canvas.height === targetHeight) return;

    // Never wipe or resize canvas mid-stroke
    if (isDrawingRef.current) return;

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d', { desynchronized: true, alpha: true });
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    redrawPage(); // Restore current page after resize
  }, [redrawPage]); // redrawPage is stable, so setupCanvas is stable too

  // EFFECT: DRAWING ENGINE
  // Stable deps — this effect only fires on mount and cleanup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleDown = (e: PointerEvent) => {
      // Capture IMMEDIATELY - highest priority
      const canvasEl = e.currentTarget as HTMLCanvasElement;
      let captured = false;
      try {
        canvasEl.setPointerCapture(e.pointerId);
        captured = true;
      } catch (_) {}

      if (e.pointerType === 'touch') return; // Palm rejection
      e.preventDefault();
      e.stopPropagation();

      const ctx = canvas.getContext('2d', { desynchronized: true });
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Always reset — even if previous stroke was mid-cancel
      isDrawingRef.current = true;
      currentStrokeRef.current = [[x, y, e.pressure || 0.5]];
      lastPointRef.current = { x, y };

      ctx.fillStyle = '#1e1b4b';
      // Stamp a dot at the starting point
      const startR = pressureToRadius(e.pressure || 0.5);
      ctx.beginPath();
      ctx.arc(x, y, startR, 0, Math.PI * 2);
      ctx.fill();
    };

    const handleMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // Palm rejection
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const ctx = canvas.getContext('2d', { desynchronized: true });
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const coalesced = (e as any).getCoalescedEvents?.() || [e];

      let prevSmoothedPressure = (e as any)._lastSmoothedPressure ?? 0.5;

      for (const event of coalesced) {
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const rawPressure = event.pressure || 0.5;

        // Low-pass smoothing
        const pressure = (prevSmoothedPressure * 0.6) + (rawPressure * 0.4);
        prevSmoothedPressure = pressure;

        const last = lastPointRef.current;
        const r = pressureToRadius(pressure);

        // Stamp a dot at this point
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Fill the gap between last point and this one
        if (last) {
          const dist = Math.hypot(x - last.x, y - last.y);
          const steps = Math.ceil(dist / (r * 0.5));
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const ix = last.x + (x - last.x) * t;
            const iy = last.y + (y - last.y) * t;
            ctx.beginPath();
            ctx.arc(ix, iy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        currentStrokeRef.current.push([x, y, pressure]);
        lastPointRef.current = { x, y };
      }
    };

    const handleUp = (e: PointerEvent) => {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch (_) {}

      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPointRef.current = null;

      const points = currentStrokeRef.current;
      currentStrokeRef.current = [];

      if (points.length > 1) {
        const rect = canvas.getBoundingClientRect();
        const pageIdx = currentPageIndexRef.current;
        
        // queueMicrotask lets the current paint frame complete
        // before React's setPages triggers a re-render + redrawPage
        queueMicrotask(() => {
          setPages(prev => {
            const next = [...prev];
            next[pageIdx] = {
              ...next[pageIdx],
              strokes: [
                ...next[pageIdx].strokes,
                { 
                  points, 
                  color: '#1e1b4b', 
                  width: 1.2,
                  canvasWidth: rect.width,
                  canvasHeight: rect.height
                },
              ],
            };
            return next;
          });
        });
      }
    };

    const handleCancel = (e: PointerEvent) => {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch (_) {}

      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPointRef.current = null;

      const points = currentStrokeRef.current;
      currentStrokeRef.current = [];

      if (points.length > 1) {
        const rect = canvas.getBoundingClientRect();
        const pageIdx = currentPageIndexRef.current;
        
        queueMicrotask(() => {
          setPages(prev => {
            const next = [...prev];
            next[pageIdx] = {
              ...next[pageIdx],
              strokes: [
                ...next[pageIdx].strokes,
                { 
                  points, 
                  color: '#1e1b4b', 
                  width: 2.0,
                  canvasWidth: rect.width,
                  canvasHeight: rect.height
                },
              ],
            };
            return next;
          });
        });
      }
    };

    const preventDefault = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
    };

    canvas.addEventListener('pointerdown', handleDown, { passive: false });
    canvas.addEventListener('pointermove', handleMove, { passive: false });
    canvas.addEventListener('pointerup', handleUp, { passive: false });
    canvas.addEventListener('pointercancel', handleCancel, { passive: false });

    // Hijack touch events to stop Safari from ever thinking about scrolling
    canvas.addEventListener('touchstart', preventDefault, { passive: false });
    canvas.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', handleDown);
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('pointerup', handleUp);
      canvas.removeEventListener('pointercancel', handleCancel);
      canvas.removeEventListener('touchstart', preventDefault);
      canvas.removeEventListener('touchmove', preventDefault);
    };
  }, []); // Stable footprint

  // EFFECT: Handle Resize & Orientation
  useEffect(() => {
    setupCanvas();
    const observer = new ResizeObserver(setupCanvas);
    if (canvasRef.current?.parentElement) {
      observer.observe(canvasRef.current.parentElement);
    }
    return () => observer.disconnect();
  }, [setupCanvas]);

  // EFFECT: Redraw when switching pages
  useEffect(() => {
    redrawPage(currentPageIndex);
  }, [currentPageIndex, redrawPage]);

  // ACTIONS

  const undo = useCallback(() => {
    setPages(prev => {
      const pageIdx = currentPageIndexRef.current;
      const next = [...prev];
      const pageStrokes = [...next[pageIdx].strokes];
      if (pageStrokes.length === 0) return prev;
      pageStrokes.pop();
      next[pageIdx] = { ...next[pageIdx], strokes: pageStrokes };
      
      // Manual ref sync before redraw to avoid one-frame lag
      pagesRef.current = next;
      redrawPage();
      
      return next;
    });
  }, [redrawPage]);

  const clearCanvas = () => {
    if (confirm('Clear this page?')) {
      const newPages = [...pages];
      newPages[currentPageIndex] = { strokes: [] };
      setPages(newPages);
      // Let useEffect sync ref and redrawPage pick it up
      
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d', { alpha: true });
        const dpr = window.devicePixelRatio || 1;
        ctx?.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      }
    }
  };

  const addPage = () => {
    setPages(prev => {
      const next = [...prev, { strokes: [] }];
      setCurrentPageIndex(next.length - 1);
      return next;
    });
  };

  const addPageFromUrl = (url: string) => {
    const nextPages = [...pagesRef.current, { strokes: [], backgroundUrl: url }];
    pagesRef.current = nextPages; // Manual ref sync
    setPages(nextPages);
    setCurrentPageIndex(nextPages.length - 1);
  };

  const loadUrlToCurrentPage = (url: string) => {
    const nextPages = [...pagesRef.current];
    const idx = currentPageIndexRef.current;
    nextPages[idx] = { ...nextPages[idx], backgroundUrl: url };
    pagesRef.current = nextPages; // Manual ref sync
    setPages(nextPages);
    redrawPage(idx);
  };

  const setText = (text: string) => {
    setPages(prev => {
      const next = [...prev];
      const idx = currentPageIndexRef.current;
      next[idx] = { ...next[idx], text };
      pagesRef.current = next;
      redrawPage(idx);
      return next;
    });
  };

  const getFullBlob = async (): Promise<Blob | null> => {
    const A4_WIDTH = 1240;
    const A4_HEIGHT = 1754;

    const currentPages = pagesRef.current; // ✅ Always fresh, never stale

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = A4_WIDTH;
    finalCanvas.height = A4_HEIGHT * currentPages.length;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return null;

    const exportOptions = {
      size: 3.5,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.85,
      simulatePressure: false,
    };

    for (let i = 0; i < currentPages.length; i++) {
      const page = currentPages[i];
      fctx.save();
      fctx.translate(0, i * A4_HEIGHT);

      // Draw Paper Background
      fctx.fillStyle = '#ffffff';
      fctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

      // 1. Draw Template (Letterhead + Patient Info)
      // Only for the first page or if explicitly requested
      if (i === 0) {
        // Header Background - Diagonal Shape
        fctx.save();
        fctx.beginPath();
        fctx.moveTo(0, 0);
        fctx.lineTo(A4_WIDTH * 0.75, 0);       // matches clip-path: 100% top
        fctx.lineTo(A4_WIDTH * 0.6375, 250);   // matches clip-path: 85% bottom
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

        // Draw Kloqo logo in top-right of header
        try {
          const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = '/Kloqo_Logo_full (2) (1).webp';
            img.onload = () => resolve(img);
            img.onerror = reject;
          });
          // Position matches the HTML: right side of header, ~30% width
          const logoW = 280;
          const logoH = 100;
          const logoX = A4_WIDTH - logoW - 80;
          const logoY = (250 - logoH) / 2; // vertically centered in header
          fctx.drawImage(logo, logoX, logoY, logoW, logoH);
        } catch {
          // logo failed to load — skip silently
        }

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
          const y = 300 + row * 45; // reduced row spacing
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
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.src = page.backgroundUrl!;
          image.onload = () => resolve(image);
          image.onerror = reject;
        });
        fctx.drawImage(img, 0, 0, A4_WIDTH, A4_HEIGHT);
      }

      page.strokes.forEach(s => {
        const scaleX = A4_WIDTH / (s.canvasWidth || 1);
        const scaleY = A4_HEIGHT / (s.canvasHeight || 1);
        const avgScale = (scaleX + scaleY) / 2;

        // ✅ Scale points BEFORE passing to getStroke
        const scaledPoints = s.points.map(([x, y, p]) => [x * scaleX, y * scaleY, p]);

        const outlinePoints = getStroke(scaledPoints, {
          ...exportOptions,
          size: exportOptions.size * avgScale, // ✅ Scale stroke width too
        });
        
        if (!outlinePoints.length) return;

        fctx!.fillStyle = '#1e1b4b';
        fctx!.beginPath();
        outlinePoints.forEach(([x, y], idx) => {
          // ✅ No manual scaling needed here anymore — points are already in A4 space
          if (idx === 0) fctx!.moveTo(x, y);
          else fctx!.lineTo(x, y);
        });
        fctx!.closePath();
        fctx!.fill();
      });

      // Draw Text if any
      if (page.text) {
        const scaleX = A4_WIDTH / (canvasRef.current?.getBoundingClientRect().width || 1);
        const scaleY = A4_HEIGHT / (canvasRef.current?.getBoundingClientRect().height || 1);
        
        fctx.fillStyle = '#1e1b4b';
        fctx.font = `500 ${Math.round(24 * scaleY)}px sans-serif`;
        const lines = page.text.split('\n');
        lines.forEach((line, idx) => {
          fctx.fillText(line, 80 * scaleX, 420 * scaleY + (idx * 36 * scaleY));
        });
      }

      fctx.restore();
    }

    return new Promise(resolve => {
      finalCanvas.toBlob(blob => resolve(blob), 'image/png');
    });
  };

  const getInkBlob = async (): Promise<Blob | null> => {
    const A4_WIDTH = 1240;
    const A4_HEIGHT = 1754;

    const currentPages = pagesRef.current;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = A4_WIDTH;
    finalCanvas.height = A4_HEIGHT * currentPages.length;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return null;

    const exportOptions = {
      size: 3.5,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.85,
      simulatePressure: false,
    };

    for (let i = 0; i < currentPages.length; i++) {
      const page = currentPages[i];
      fctx.save();
      fctx.translate(0, i * A4_HEIGHT);

      if (page.backgroundUrl) {
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.src = page.backgroundUrl!;
            image.onload = () => resolve(image);
            image.onerror = reject;
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

      // Draw Text if any
      if (page.text) {
        const scaleX = A4_WIDTH / (canvasRef.current?.getBoundingClientRect().width || 1);
        const scaleY = A4_HEIGHT / (canvasRef.current?.getBoundingClientRect().height || 1);
        
        fctx.fillStyle = '#1e1b4b';
        fctx.font = `500 ${Math.round(24 * scaleY)}px sans-serif`;
        const lines = page.text.split('\n');
        lines.forEach((line, idx) => {
          fctx.fillText(line, 80 * scaleX, 420 * scaleY + (idx * 36 * scaleY));
        });
      }

      fctx.restore();
    }

    return new Promise(resolve => {
      finalCanvas.toBlob(blob => resolve(blob), 'image/png');
    });
  };

  return {
    canvasRef,
    clearCanvas,
    undo,
    getFullBlob,
    getInkBlob,
    addPage,
    addPageFromUrl,
    loadUrlToCurrentPage,
    setText,
    currentPageIndex,
    totalPages: pages.length,
    setCurrentPageIndex,
    hasDrawing: pages[currentPageIndex]?.strokes.length > 0 || !!pages[currentPageIndex]?.backgroundUrl || !!pages[currentPageIndex]?.text,
    pages
  };
}
