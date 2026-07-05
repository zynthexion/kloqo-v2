'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Doctor, Clinic, Patient, Appointment, PrescriptionPage } from '@kloqo/shared';
import { PrescriptionDraftService } from '@kloqo/shared-core';
import { usePrescriptionExport } from './usePrescriptionExport';
import { useDrawingEngine } from './useDrawingEngine';

export interface UsePrescriptionDrawingOptions {
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
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  
  // Initialize with draft if available
  const [pages, setPages] = useState<PrescriptionPage[]>(() => {
    const draft = PrescriptionDraftService.get(appointment.id);
    return draft?.pages || [{ strokes: [] }];
  });
  
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoadingBackground, setIsLoadingBackground] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);

  // Check for draft restoration notification
  useEffect(() => {
    const draft = PrescriptionDraftService.get(appointment.id);
    if (draft) {
      console.log(`[usePrescriptionDrawing] Rehydrating draft from ${new Date(draft.timestamp).toLocaleTimeString()}`);
      setDraftRestoredAt(draft.timestamp);
      // Run cleanup on launch
      PrescriptionDraftService.cleanup(12);
    }
  }, [appointment.id]);

  const { canvasRef, redrawPage, setupCanvas } = useDrawingEngine({
    pages,
    setPages,
    currentPageIndex,
    setIsLoadingBackground,
    setLoadError,
    imageCacheRef
  });

  const { getFullBlob: _getFullBlob, getInkBlob: _getInkBlob } = usePrescriptionExport({
    doctor,
    clinic,
    patient,
    appointment,
    imageCacheRef
  });

  // AUTO-SAVE LOGIC (Debounced to 1.5s)
  useEffect(() => {
    // If empty, ensure we clear any existing draft to avoid stale rehydration on refresh
    if (pages.length === 1 && pages[0].strokes.length === 0 && !pages[0].text && !pages[0].backgroundUrl) {
      PrescriptionDraftService.clear(appointment.id);
      return;
    }

    const timer = setTimeout(() => {
      console.log(`[usePrescriptionDrawing] Auto-save triggered for ${appointment.id}`);
      PrescriptionDraftService.save(appointment.id, pages);
    }, 1500);

    return () => clearTimeout(timer);
  }, [pages, appointment.id]);

  useEffect(() => {
    setupCanvas();
    const observer = new ResizeObserver(setupCanvas);
    if (canvasRef.current?.parentElement) {
      observer.observe(canvasRef.current.parentElement);
    }
    return () => observer.disconnect();
  }, [setupCanvas, canvasRef]);

  useEffect(() => {
    redrawPage(currentPageIndex);
  }, [currentPageIndex, pages, redrawPage]);

  const undo = useCallback(() => {
    setPages(prev => {
      const next = [...prev];
      const pageStrokes = [...next[currentPageIndex].strokes];
      if (pageStrokes.length === 0) return prev;
      pageStrokes.pop();
      next[currentPageIndex] = { ...next[currentPageIndex], strokes: pageStrokes };
      return next;
    });
  }, [currentPageIndex]);

  const clearCanvas = () => {
    if (confirm('Clear this page?')) {
      setPages(prev => {
        const next = [...prev];
        next[currentPageIndex] = { ...next[currentPageIndex], strokes: [] };
        return next;
      });
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
    setPages(prev => {
      const next = [...prev, { strokes: [], backgroundUrl: url }];
      setCurrentPageIndex(next.length - 1);
      return next;
    });
  };

  const loadUrlToCurrentPage = (url: string) => {
    setPages(prev => {
      const next = [...prev];
      next[currentPageIndex] = { ...next[currentPageIndex], backgroundUrl: url };
      return next;
    });
  };

  const setText = (text: string) => {
    setPages(prev => {
      const next = [...prev];
      next[currentPageIndex] = { ...next[currentPageIndex], text };
      return next;
    });
  };

  const clearDraft = useCallback(() => {
    PrescriptionDraftService.clear(appointment.id);
  }, [appointment.id]);

  return useMemo(() => ({
    canvasRef,
    undo,
    clearCanvas,
    addPage,
    addPageFromUrl,
    loadUrlToCurrentPage,
    setText,
    currentPageIndex,
    totalPages: pages.length,
    setCurrentPageIndex,
    hasDrawing: pages[currentPageIndex]?.strokes.length > 0 || !!pages[currentPageIndex]?.backgroundUrl || !!pages[currentPageIndex]?.text,
    pages,
    isLoadingBackground,
    loadError,
    draftRestoredAt,
    clearDraft,
    getFullBlob: () => _getFullBlob(pages),
    getInkBlob: () => _getInkBlob(pages)
  }), [
    pages,
    currentPageIndex,
    isLoadingBackground,
    loadError,
    draftRestoredAt,
    clearDraft,
    _getFullBlob,
    _getInkBlob,
    undo
  ]);
}
