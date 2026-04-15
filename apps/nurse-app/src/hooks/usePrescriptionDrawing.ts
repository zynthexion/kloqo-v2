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

  // REACT STATE (For committed strokes and page management)
  const [pages, setPages] = useState<PageData[]>([{ strokes: [] }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // CPU COACHING: Path2D cache to avoid re-reduction of coordinate arrays
  const pathCacheRef = useRef(new WeakMap<number[][], Path2D>());

  // STROKE OPTIONS (Physically accurate ink)
  const strokeOptions = useMemo(() => ({
    size: 1.8, // Reduced for professional fine-tip feel
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.6, // Increased slightly for smoother curves on rapid movement
  }), []);

  const getSvgPathFromStroke = useCallback((stroke: number[][]) => {
    if (!stroke.length) return "";
    const outlinePoints = getStroke(stroke, strokeOptions);
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
  }, [strokeOptions]);

  // REDRAW BASE LAYER (Committed Strokes)
  const redrawBase = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.fillStyle = '#1e1b4b'; // Deep Indigo Ink

    const currentStrokes = pages[currentPageIndex]?.strokes || [];
    currentStrokes.forEach((stroke) => {
      // Use cache or re-compile
      let path = pathCacheRef.current.get(stroke.points);
      if (!path) {
        const pathData = getSvgPathFromStroke(stroke.points);
        path = new Path2D(pathData);
        pathCacheRef.current.set(stroke.points, path);
      }
      ctx.fill(path);
    });
  }, [pages, currentPageIndex, getSvgPathFromStroke]);

  // HARDWARE INITIALIZER (DPR & Scaling)
  const setupCanvases = useCallback(() => {
    const dpr = window.devicePixelRatio || 1;
    [baseCanvasRef.current, activeCanvasRef.current].forEach(canvas => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      
      // Render Guard: Only reset if dimensions actually changed
      const targetWidth = Math.floor(rect.width * dpr);
      const targetHeight = Math.floor(rect.height * dpr);
      
      if (canvas.width === targetWidth && canvas.height === targetHeight) {
        return; // Skip reset
      }

      // 1. Scale internal resolution for Retina
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      // 2. Scale context so coordinates match logical pixels
      const ctx = canvas.getContext('2d', { 
        desynchronized: canvas === activeCanvasRef.current,
        alpha: true 
      });
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
        ctx.scale(dpr, dpr);
      }
    });

    redrawBase();
  }, [redrawBase]);

  // SAFARI-SAFE IDLE SCHEDULER
  const runInIdle = useCallback((callback: () => void) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(callback);
    } else {
      setTimeout(callback, 0); // Safari/Old iOS Fallback
    }
  }, []);

  // EFFECT: INDUSTRIAL-GRADE HARDWARE ISOLATION
  useEffect(() => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    const handleDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);

      isDrawingRef.current = true;
      const rect = canvas.getBoundingClientRect();
      currentStrokeRef.current = [[e.clientX - rect.left, e.clientY - rect.top, e.pressure]];
    };

    const handleMove = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const coalescedEvents = (e as any).getCoalescedEvents?.() || [e];
      
      for (const event of coalescedEvents) {
        currentStrokeRef.current.push([
          event.clientX - rect.left,
          event.clientY - rect.top,
          event.pressure
        ]);
      }

      // Wipe & Fill Active Layer (Hardware Fast Path)
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.fillStyle = '#1e1b4b';
      
      const pathData = getSvgPathFromStroke(currentStrokeRef.current);
      const path = new Path2D(pathData);
      ctx.fill(path);
    };

    const handleUp = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);

      const points = currentStrokeRef.current;
      if (points.length > 1) {
        // 1. ATOMIC HANDOVER (Imperative & Immediate)
        const baseCanvas = baseCanvasRef.current;
        if (baseCanvas) {
          const bCtx = baseCanvas.getContext('2d', { alpha: true });
          const dpr = window.devicePixelRatio || 1;
          if (bCtx) {
            let path = pathCacheRef.current.get(points);
            if (!path) {
              path = new Path2D(getSvgPathFromStroke(points));
              pathCacheRef.current.set(points, path);
            }
            bCtx.fillStyle = '#1e1b4b';
            bCtx.fill(path);
          }
        }

        // Immediately clear the active layer
        const ctx = canvas.getContext('2d', { alpha: true });
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        }

        // 2. BACKGROUND PERSISTENCE (Non-blocking)
        runInIdle(() => {
          setPages(prev => {
            const next = [...prev];
            next[currentPageIndex].strokes.push({
              points,
              color: '#1e1b4b',
              width: 1.8
            });
            return next;
          });
        });
      }

      currentStrokeRef.current = [];
    };

    // Attach native DOM listeners with passive: false to hijack iPad gestures
    canvas.addEventListener('pointerdown', handleDown, { passive: false });
    canvas.addEventListener('pointermove', handleMove, { passive: false });
    canvas.addEventListener('pointerup', handleUp, { passive: false });
    canvas.addEventListener('pointerleave', handleUp, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', handleDown);
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('pointerup', handleUp);
      canvas.removeEventListener('pointerleave', handleUp);
    };
  }, [getSvgPathFromStroke, currentPageIndex, runInIdle]);

  // EFFECT: Handle Resize & Orientation
  useEffect(() => {
    setupCanvases();
    const observer = new ResizeObserver(() => setupCanvases());
    if (activeCanvasRef.current?.parentElement) {
      observer.observe(activeCanvasRef.current.parentElement);
    }
    return () => observer.disconnect();
  }, [setupCanvases]);

  const clearCanvas = () => {
    if (confirm('Clear this page?')) {
      const newPages = [...pages];
      newPages[currentPageIndex].strokes = [];
      setPages(newPages);
    }
  };

  const addPage = () => {
    setPages([...pages, { strokes: [] }]);
    setCurrentPageIndex(pages.length);
  };

  const getBlob = async (): Promise<Blob | null> => {
    // Standard A4 Dimensions at 150 DPI for export
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
      
      // Upscale logic: Map current screen Rect to 1240x1754
      const canvas = baseCanvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = A4_WIDTH / rect.width;
        const scaleY = A4_HEIGHT / rect.height;
        fctx.scale(scaleX, scaleY);
      }

      page.strokes.forEach(s => {
        const pathData = getSvgPathFromStroke(s.points);
        const path = new Path2D(pathData);
        fctx!.fillStyle = '#1e1b4b';
        fctx!.fill(path);
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
