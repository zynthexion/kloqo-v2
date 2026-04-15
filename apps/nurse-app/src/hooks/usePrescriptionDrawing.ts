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

  // STROKE OPTIONS (Physically accurate ink)
  const strokeOptions = useMemo(() => ({
    size: 2.5,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
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

    ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    ctx.fillStyle = '#1e1b4b'; // Deep Indigo Ink

    const currentStrokes = pages[currentPageIndex]?.strokes || [];
    currentStrokes.forEach((stroke) => {
      const pathData = getSvgPathFromStroke(stroke.points);
      const path = new Path2D(pathData);
      ctx.fill(path);
    });
  }, [pages, currentPageIndex, getSvgPathFromStroke]);

  // HARDWARE INITIALIZER (DPR & Scaling)
  const setupCanvases = useCallback(() => {
    const dpr = window.devicePixelRatio || 1;
    [baseCanvasRef.current, activeCanvasRef.current].forEach(canvas => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      
      // 1. Scale internal resolution for Retina
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // 2. Scale context so coordinates match logical pixels
      const ctx = canvas.getContext('2d', { 
        desynchronized: canvas === activeCanvasRef.current, // Active layer uses desynchronized buffer
        alpha: true 
      });
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
        ctx.scale(dpr, dpr);
      }
    });

    redrawBase();
  }, [redrawBase]);

  // EFFECT: Handle Resize & Orientation
  useEffect(() => {
    setupCanvases();
    
    // ResizeObserver is more robust than window.resize for layout changes
    const observer = new ResizeObserver(() => {
      setupCanvases();
    });

    if (activeCanvasRef.current?.parentElement) {
      observer.observe(activeCanvasRef.current.parentElement);
    }

    return () => observer.disconnect();
  }, [setupCanvases]);

  // POINTER HANDLERS (Bypassing React state)
  const onPointerDown = (e: React.PointerEvent) => {
    const canvas = activeCanvasRef.current;
    if (!canvas) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    
    // Initial point
    currentStrokeRef.current = [[e.clientX - rect.left, e.clientY - rect.top, e.pressure]];
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;
    const canvas = activeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();

    // Hardware Precision: Extract micro-movements (120Hz support)
    const coalescedEvents = (e.nativeEvent as any).getCoalescedEvents?.() || [e.nativeEvent];
    
    for (const event of coalescedEvents) {
      currentStrokeRef.current.push([
        event.clientX - rect.left,
        event.clientY - rect.top,
        event.pressure
      ]);
    }

    // Wipe & Fill Active Layer (Preventing Anti-alias bleed)
    ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    ctx.fillStyle = '#1e1b4b';
    
    const pathData = getSvgPathFromStroke(currentStrokeRef.current);
    const path = new Path2D(pathData);
    ctx.fill(path);
  };

  const onPointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentStrokeRef.current.length > 1) {
      const newPages = [...pages];
      newPages[currentPageIndex].strokes.push({ 
        points: currentStrokeRef.current, 
        color: '#1e1b4b', 
        width: 2.5 
      });
      setPages(newPages); // React render triggers redrawBase
    }

    // Clear Active Layer
    const canvas = activeCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx?.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    }
    
    currentStrokeRef.current = [];
  };

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
      
      // We need to scale the strokes because they were captured at screen resolution
      // However, to keep it simple and consistent for now, we assume fixed ratio mapping 
      // is handled during capture if we want native A4 export.
      // For this Enterprise approach, we only export the relative coordinates or upscale.
      
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
    hasDrawing: pages.some(p => p.strokes.length > 0),
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave: onPointerUp,
    }
  };
}
