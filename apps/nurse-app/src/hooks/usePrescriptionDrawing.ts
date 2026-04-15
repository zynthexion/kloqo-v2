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

  // Pressure to line width — Apple Pencil range
  const pressureToWidth = (pressure: number) =>
    1.0 + (pressure || 0.5) * 2.5;

  // REDRAW PAGE — reads from refs, has zero React dependencies
  // Safe to call anytime without triggering re-render chains
  const redrawPage = useCallback((pageIndex?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const idx = pageIndex ?? currentPageIndexRef.current;
    const strokes = pagesRef.current[idx]?.strokes ?? [];

    ctx.strokeStyle = '#1e1b4b';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokes.forEach(stroke => {
      const pts = stroke.points;
      if (pts.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);

      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const midX = (prev[0] + curr[0]) / 2;
        const midY = (prev[1] + curr[1]) / 2;
        ctx.lineWidth = pressureToWidth(curr[2]);
        ctx.quadraticCurveTo(prev[0], prev[1], midX, midY);
      }
      ctx.stroke();
    });
  }, []); // Stable forever — reads from refs, not state

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
      if (e.pointerType === 'touch') return; // Palm rejection
      e.preventDefault();
      e.stopPropagation();

      // Capture is optional — never block drawing on failure
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch (_) {}

      const ctx = canvas.getContext('2d', { desynchronized: true });
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Always reset — even if previous stroke was mid-cancel
      isDrawingRef.current = true;
      currentStrokeRef.current = [[x, y, e.pressure || 0.5]];
      lastPointRef.current = { x, y };

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handleMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // Palm rejection
      if (!isDrawingRef.current) return;
      e.preventDefault();

      const ctx = canvas.getContext('2d', { desynchronized: true });
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const coalesced = (e as any).getCoalescedEvents?.() || [e];

      // ONE path for ALL coalesced points this frame — no gaps
      ctx.beginPath();

      const startLast = lastPointRef.current;
      if (startLast) ctx.moveTo(startLast.x, startLast.y);

      let lastPressure = 0.5;

      for (const event of coalesced) {
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const pressure = event.pressure || 0.5;

        currentStrokeRef.current.push([x, y, pressure]);

        const last = lastPointRef.current;
        if (last) {
          // Midpoint quadratic — guaranteed smooth curves
          const midX = (last.x + x) / 2;
          const midY = (last.y + y) / 2;
          ctx.quadraticCurveTo(last.x, last.y, midX, midY);
        }

        lastPointRef.current = { x, y };
        lastPressure = pressure;
      }

      // ONE lineWidth and ONE stroke call per frame
      ctx.lineWidth = pressureToWidth(lastPressure);
      ctx.stroke();
    };

    const handleUp = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPointRef.current = null;

      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch (_) {}

      const points = currentStrokeRef.current;
      currentStrokeRef.current = [];

      if (points.length > 1) {
        const rect = canvas.getBoundingClientRect();
        const pageIdx = currentPageIndexRef.current;
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
      }
    };

    const handleCancel = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPointRef.current = null;

      const points = currentStrokeRef.current;
      currentStrokeRef.current = [];

      if (points.length > 1) {
        const rect = canvas.getBoundingClientRect();
        const pageIdx = currentPageIndexRef.current;
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
      }
    };

    canvas.addEventListener('pointerdown', handleDown, { passive: false });
    canvas.addEventListener('pointermove', handleMove, { passive: false });
    canvas.addEventListener('pointerup', handleUp);
    canvas.addEventListener('pointerleave', handleUp);
    canvas.addEventListener('pointercancel', handleCancel);

    return () => {
      canvas.removeEventListener('pointerdown', handleDown);
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('pointerup', handleUp);
      canvas.removeEventListener('pointerleave', handleUp);
      canvas.removeEventListener('pointercancel', handleCancel);
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

  const getBlob = async (): Promise<Blob | null> => {
    const A4_WIDTH = 1240;
    const A4_HEIGHT = 1754;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = A4_WIDTH;
    finalCanvas.height = A4_HEIGHT * pages.length;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return null;

    const exportOptions = {
      size: 2.0,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.85,
      simulatePressure: false,
    };

    pages.forEach((page, i) => {
      fctx.save();
      fctx.translate(0, i * A4_HEIGHT);

      page.strokes.forEach(s => {
        // Correct scaling using snapshot dimensions
        const scaleX = A4_WIDTH / s.canvasWidth;
        const scaleY = A4_HEIGHT / s.canvasHeight;
        
        const outlinePoints = getStroke(s.points, exportOptions);
        if (!outlinePoints.length) return;

        const d = outlinePoints.reduce(
          (acc, [x, y], idx) => {
            // Apply scale to points during export
            const sx = x * scaleX;
            const sy = y * scaleY;
            if (idx === 0) acc.push('M', sx, sy, 'Q');
            else acc.push(sx, sy);
            return acc;
          },
          [] as any[]
        );
        d.push('Z');

        const path = new Path2D(d.join(' '));
        fctx!.fillStyle = '#1e1b4b';
        fctx!.fill(path);
      });

      fctx.restore();
    });

    return new Promise(resolve => {
      finalCanvas.toBlob(blob => resolve(blob), 'image/png');
    });
  };

  return {
    canvasRef,
    clearCanvas,
    undo,
    getBlob,
    addPage,
    currentPageIndex,
    totalPages: pages.length,
    setCurrentPageIndex,
    hasDrawing: pages[currentPageIndex]?.strokes.length > 0,
  };
}
