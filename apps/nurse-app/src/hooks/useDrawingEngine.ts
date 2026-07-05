import { useRef, useEffect, useCallback } from 'react';
import { PrescriptionPage, PrescriptionStroke } from '@kloqo/shared';
import { URLUtils } from '@kloqo/shared-core';

interface UseDrawingEngineOptions {
  pages: PrescriptionPage[];
  setPages: React.Dispatch<React.SetStateAction<PrescriptionPage[]>>;
  currentPageIndex: number;
  setIsLoadingBackground: (loading: boolean) => void;
  setLoadError: (error: string | null) => void;
  imageCacheRef: React.MutableRefObject<Map<string, HTMLImageElement>>;
}

export function useDrawingEngine({
  pages,
  setPages,
  currentPageIndex,
  setIsLoadingBackground,
  setLoadError,
  imageCacheRef
}: UseDrawingEngineOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<number[][]>([]);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Remove stale refs to ensure reactive updates
  const pressureToRadius = (pressure: number) => 0.3 + (pressure || 0.5) * 0.6;

  const redrawPage = useCallback((pageIndex?: number) => {
    if (isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const idx = pageIndex ?? currentPageIndex;
    const page = pages[idx];
    const strokes = page?.strokes ?? [];
    const backgroundUrl = page?.backgroundUrl;

    const drawStrokes = () => {
      strokes.forEach((stroke: PrescriptionStroke) => {
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
      const cached = imageCacheRef.current.get(backgroundUrl);
      if (cached && cached.complete) {
        ctx.drawImage(cached, 0, 0, canvas.width / dpr, canvas.height / dpr);
        drawStrokes();
        return;
      }
      setIsLoadingBackground(true);
      setLoadError(null);
      const img = new Image();
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      img.crossOrigin = 'anonymous';
      img.src = URLUtils.getProxiedUrl(backgroundUrl, API_URL);
      img.onload = () => {
        imageCacheRef.current.set(backgroundUrl, img);
        setIsLoadingBackground(false);
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
        drawStrokes();
      };
      img.onerror = (err) => {
        setIsLoadingBackground(false);
        setLoadError("Background load failed");
        console.error('[useDrawingEngine] Background load failed for URL:', img.src, err);
        drawStrokes();
      };
    } else {
      drawStrokes();
    }
  }, [pages, currentPageIndex, imageCacheRef, setIsLoadingBackground, setLoadError]);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const targetWidth = Math.floor(rect.width * dpr);
    const targetHeight = Math.floor(rect.height * dpr);
    if (canvas.width === targetWidth && canvas.height === targetHeight) return;
    if (isDrawingRef.current) return;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { desynchronized: true, alpha: true });
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
    redrawPage();
  }, [redrawPage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleDown = (e: PointerEvent) => {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      isDrawingRef.current = true;
      currentStrokeRef.current = [[x, y, e.pressure || 0.5]];
      lastPointRef.current = { x, y };
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.arc(x, y, pressureToRadius(e.pressure || 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const handleMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !isDrawingRef.current) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d', { desynchronized: true });
      if (!ctx) return;
      const coalesced = (e as any).getCoalescedEvents?.() || [e];
      for (const event of coalesced) {
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const pressure = event.pressure || 0.5;
        const last = lastPointRef.current;
        const r = pressureToRadius(pressure);
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (last) {
          const dist = Math.hypot(x - last.x, y - last.y);
          const steps = Math.ceil(dist / (r * 0.5));
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            ctx.beginPath();
            ctx.arc(last.x + (x - last.x) * t, last.y + (y - last.y) * t, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        currentStrokeRef.current.push([x, y, pressure]);
        lastPointRef.current = { x, y };
      }
    };

    const handleUp = (e: PointerEvent) => {
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const points = currentStrokeRef.current;
      currentStrokeRef.current = [];
      if (points.length > 1) {
        const rect = canvas.getBoundingClientRect();
        const pageIdx = currentPageIndex;
        queueMicrotask(() => {
          setPages(prev => {
            const next = [...prev];
            if (!next[pageIdx]) return prev;
            next[pageIdx] = {
              ...next[pageIdx],
              strokes: [...next[pageIdx].strokes, { 
                points, color: '#1e1b4b', width: 1.2, 
                canvasWidth: rect.width, canvasHeight: rect.height 
              }]
            };
            return next;
          });
        });
      }
    };

    const preventDefault = (ev: TouchEvent) => { if (ev.cancelable) ev.preventDefault(); };
    canvas.addEventListener('pointerdown', handleDown, { passive: false });
    canvas.addEventListener('pointermove', handleMove, { passive: false });
    canvas.addEventListener('pointerup', handleUp, { passive: false });
    canvas.addEventListener('pointercancel', handleUp, { passive: false });
    canvas.addEventListener('touchstart', preventDefault, { passive: false });
    canvas.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', handleDown);
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('pointerup', handleUp);
      canvas.removeEventListener('pointercancel', handleUp);
      canvas.removeEventListener('touchstart', preventDefault);
      canvas.removeEventListener('touchmove', preventDefault);
    };
  }, [setPages, currentPageIndex, pages.length]);

  return { canvasRef, redrawPage, setupCanvas };
}
