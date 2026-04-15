'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { getStroke } from 'perfect-freehand';
import { Doctor, Clinic, Patient, Appointment } from '@kloqo/shared';

interface Stroke {
  points: number[][];
  color: string;
  width: number;
}

interface PageData {
  strokes: Stroke[];
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
  appointment 
}: UsePrescriptionDrawingOptions) {
  // TWO-CANVAS ARCHITECTURE
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);

  // SILENT STATE (Bypassing React for active drawing)
  const currentStrokeRef = useRef<number[][]>([]);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // REACT STATE (For committed strokes and page management)
  const [pages, setPages] = useState<PageData[]>([{ strokes: [] }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // perfect-freehand is kept ONLY for high-quality PDF export (offline, not live)
  const exportStrokeOptions = useMemo(() => ({
    size: 2.0,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.85,
    simulatePressure: false,
  }), []);

  const getSvgPathFromStroke = useCallback((stroke: number[][]) => {
    if (!stroke.length) return "";
    const outlinePoints = getStroke(stroke, exportStrokeOptions);
    const d = outlinePoints.reduce(
      (acc, [x, y], i) => {
        if (i === 0) acc.push("M", x, y, "Q");
        else acc.push(x, y);
        return acc;
      },
      [] as any[]
    );
    d.push("Z");
    return d.join(" ");
  }, [exportStrokeOptions]);

  // Pressure to line width mapping for Apple Pencil
  const pressureToWidth = (pressure: number) => {
    const min = 1.0;
    const max = 3.5;
    return min + (pressure || 0.5) * (max - min);
  };

  // REDRAW BASE LAYER — uses perfect-freehand for a high-quality re-render
  const redrawBase = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.fillStyle = '#1e1b4b';

    const currentStrokes = pages[currentPageIndex]?.strokes || [];
    currentStrokes.forEach((stroke) => {
      const pathData = getSvgPathFromStroke(stroke.points);
      if (pathData) {
        const path = new Path2D(pathData);
        ctx.fill(path);
      }
    });
  }, [pages, currentPageIndex, getSvgPathFromStroke]);

  // HARDWARE INITIALIZER (DPR & Scaling)
  const setupCanvases = useCallback(() => {
    const dpr = window.devicePixelRatio || 1;
    [baseCanvasRef.current, activeCanvasRef.current].forEach(canvas => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const targetWidth = Math.floor(rect.width * dpr);
      const targetHeight = Math.floor(rect.height * dpr);

      // Render Guard: Only reset if dimensions actually changed
      if (canvas.width === targetWidth && canvas.height === targetHeight) return;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d', {
        desynchronized: canvas === activeCanvasRef.current,
        alpha: true
      });
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        if (canvas === activeCanvasRef.current) {
          // Pre-configure active canvas pen style
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#1e1b4b';
        }
      }
    });

    redrawBase();
  }, [redrawBase]);

  // SAFARI-SAFE IDLE SCHEDULER
  const runInIdle = useCallback((callback: () => void) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(callback);
    } else {
      setTimeout(callback, 0); // Safari / Old iOS fallback
    }
  }, []);

  // EFFECT: INCREMENTAL DRAWING ENGINE
  // Hardware-direct. O(1) per frame. No wipe-and-redraw.
  useEffect(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    const handleDown = (e: PointerEvent) => {
      // Ignore finger touches — only Apple Pencil (stylus). This is app-level palm rejection.
      if (e.pointerType === 'touch') return;

      e.preventDefault();
      e.stopPropagation();

      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch (_) { /* ignore */ }

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      isDrawingRef.current = true;
      currentStrokeRef.current = [[x, y, e.pressure]];
      lastPointRef.current = { x, y };

      // Open the canvas path at the touchdown point
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handleMove = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      // 120Hz point extraction from Apple Pencil hardware
      const coalescedEvents = (e as any).getCoalescedEvents?.() || [e];

      for (const event of coalescedEvents) {
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const pressure = event.pressure || 0.5;

        currentStrokeRef.current.push([x, y, pressure]);

        const last = lastPointRef.current;
        if (!last) {
          lastPointRef.current = { x, y };
          continue;
        }

        // Midpoint Quadratic Curve — eliminates angular corners during fast movements
        const midX = (last.x + x) / 2;
        const midY = (last.y + y) / 2;

        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.quadraticCurveTo(last.x, last.y, midX, midY);
        ctx.lineWidth = pressureToWidth(pressure);
        ctx.stroke();

        lastPointRef.current = { x, y };
      }
    };

    const handleUp = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPointRef.current = null;

      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch (_) {
        // Already auto-released by pointercancel — safe to ignore
      }

      const points = currentStrokeRef.current;
      currentStrokeRef.current = [];

      if (points.length > 1) {
        // 1. GPU Blit: Copy active canvas → base canvas in a single drawImage call.
        //    This is O(1) — zero CPU math. The fastest possible handover.
        const baseCanvas = baseCanvasRef.current;
        if (baseCanvas) {
          const bCtx = baseCanvas.getContext('2d');
          if (bCtx) {
            // Operate in pixel space to avoid DPR double-scaling
            bCtx.save();
            bCtx.setTransform(1, 0, 0, 1, 0, 0);
            bCtx.drawImage(canvas, 0, 0);
            bCtx.restore();
          }
        }

        // 2. Clear active layer — now safe since stroke is on base layer
        const ctx = canvas.getContext('2d', { alpha: true });
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        }

        // 3. Background Persistence — non-blocking React state update
        runInIdle(() => {
          setPages(prev => {
            const next = [...prev];
            next[currentPageIndex].strokes.push({
              points,
              color: '#1e1b4b',
              width: 2.0
            });
            return next;
          });
        });
      }
    };

    canvas.addEventListener('pointerdown', handleDown, { passive: false });
    canvas.addEventListener('pointermove', handleMove, { passive: false });
    canvas.addEventListener('pointerup', handleUp);
    canvas.addEventListener('pointerleave', handleUp);
    canvas.addEventListener('pointercancel', handleUp); // Palm rejection guard

    return () => {
      canvas.removeEventListener('pointerdown', handleDown);
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('pointerup', handleUp);
      canvas.removeEventListener('pointerleave', handleUp);
      canvas.removeEventListener('pointercancel', handleUp);
    };
  }, [currentPageIndex, runInIdle]);

  // EFFECT: Handle Resize & Orientation
  useEffect(() => {
    setupCanvases();
    const observer = new ResizeObserver(() => setupCanvases());
    if (activeCanvasRef.current?.parentElement) {
      observer.observe(activeCanvasRef.current.parentElement);
    }
    return () => observer.disconnect();
  }, [setupCanvases]);

  // EFFECT: Sync base layer when pages state updates
  useEffect(() => {
    redrawBase();
  }, [pages, currentPageIndex, redrawBase]);

  const clearCanvas = () => {
    if (confirm('Clear this page?')) {
      const newPages = [...pages];
      newPages[currentPageIndex].strokes = [];
      setPages(newPages);
      // Also clear active layer in case there is a stroke in progress
      const canvas = activeCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d', { alpha: true });
        const dpr = window.devicePixelRatio || 1;
        ctx?.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      }
    }
  };

  const addPage = () => {
    setPages([...pages, { strokes: [] }]);
    setCurrentPageIndex(pages.length);
  };

  const getBlob = async (): Promise<Blob | null> => {
    // Standard A4 at 150 DPI for export — uses perfect-freehand for quality
    const A4_WIDTH = 1240;
    const A4_HEIGHT = 1754;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = A4_WIDTH;
    finalCanvas.height = A4_HEIGHT * pages.length;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return null;

    pages.forEach((page, i) => {
      fctx.save();
      fctx.translate(0, i * A4_HEIGHT);

      const canvas = baseCanvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = A4_WIDTH / rect.width;
        const scaleY = A4_HEIGHT / rect.height;
        fctx.scale(scaleX, scaleY);
      }

      page.strokes.forEach(s => {
        const pathData = getSvgPathFromStroke(s.points);
        if (pathData) {
          const path = new Path2D(pathData);
          fctx!.fillStyle = '#1e1b4b';
          fctx!.fill(path);
        }
      });
      fctx.restore();
    });

    return new Promise((resolve) => {
      finalCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  };

  return {
    baseCanvasRef,
    activeCanvasRef,
    clearCanvas,
    getBlob,
    addPage,
    currentPageIndex,
    totalPages: pages.length,
    setCurrentPageIndex,
    hasDrawing: pages.some(p => p.strokes.length > 0)
  };
}
