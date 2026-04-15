'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { getStroke } from 'perfect-freehand';
import { format } from 'date-fns';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pages, setPages] = useState<PageData[]>([{ strokes: [] }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [currentStroke, setCurrentStroke] = useState<number[][] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);

  // Constants for A4 at 150 DPI
  const A4_WIDTH = 1240;
  const A4_HEIGHT = 1754;

  const currentStrokes = pages[currentPageIndex]?.strokes || [];

  const strokeOptions = useMemo(() => ({
    size: 2.5,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  }), []);

  // Pre-load logo
  useEffect(() => {
    const img = new Image();
    img.src = '/Kloqo_Logo_full (2) (1).webp';
    img.onload = () => setLogoImage(img);
  }, []);

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


  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Crucial: Transparent Glass Layer

    ctx.fillStyle = '#1e1b4b'; // Deep Indigo Ink

    currentStrokes.forEach((stroke) => {
      const pathData = getSvgPathFromStroke(stroke.points);
      const path = new Path2D(pathData);
      ctx.fill(path);
    });

    if (currentStroke) {
      const pathData = getSvgPathFromStroke(currentStroke);
      const path = new Path2D(pathData);
      ctx.fill(path);
    }
  }, [currentStrokes, currentStroke, getSvgPathFromStroke]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = A4_WIDTH;
      canvas.height = A4_HEIGHT;
      redraw();
    }
  }, [redraw]);

  const onPointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    setCurrentStroke([[(e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale, e.pressure]]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !currentStroke) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    setCurrentStroke([...currentStroke, [(e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale, e.pressure]]);
  };

  const onPointerUp = () => {
    if (currentStroke) {
      const newPages = [...pages];
      newPages[currentPageIndex].strokes.push({ points: currentStroke, color: '#1e1b4b', width: 2.5 });
      setPages(newPages);
    }
    setCurrentStroke(null);
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (confirm('Clear this page?')) {
      const newPages = [...pages];
      newPages[currentPageIndex].strokes = [];
      setPages(newPages);
      setCurrentStroke(null);
    }
  };

  const addPage = () => {
    setPages([...pages, { strokes: [] }]);
    setCurrentPageIndex(pages.length);
  };

  const getBlob = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    // To support multi-page in a single upload without merging template layout,
    // we only capture the pure transparent ink.
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = A4_WIDTH;
    finalCanvas.height = A4_HEIGHT * pages.length;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return null;

    for (let i = 0; i < pages.length; i++) {
        fctx.save();
        fctx.translate(0, i * A4_HEIGHT);
        pages[i].strokes.forEach(s => {
            const pathData = getSvgPathFromStroke(s.points);
            const path = new Path2D(pathData);
            fctx!.fillStyle = '#1e1b4b';
            fctx!.fill(path);
        });
        fctx.restore();
    }

    return new Promise((resolve) => {
      // Must export as PNG to preserve transparent ink!
      finalCanvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  };

  return {
    canvasRef,
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
