import React, { useState } from 'react';
import { RotateCcw, Trash2, Pause, Printer, CheckCircle2, ChevronLeft, ChevronRight, PlusCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Doctor, Clinic, Patient, Appointment } from '@kloqo/shared';
import { usePrescriptionDrawing } from '@/hooks/usePrescriptionDrawing';
import { getClinic12hTimeString } from '@kloqo/shared-core';
import { PrescriptionPaperTemplate } from './PrescriptionPaperTemplate';

export interface PrescriptionCanvasHandle {
  addPageFromUrl: (url: string) => void;
  loadUrlToCurrentPage: (url: string) => void;
  setText: (text: string) => void;
}

interface PrescriptionCanvasProps {
  onComplete: (fullBlob: Blob, inkBlob: Blob) => void;
  onSkip?: () => void;
  onPrint?: (blob: Blob) => void;
  doctor: Doctor;
  clinic: Clinic;
  patient: Patient;
  appointment: Appointment;
  isSubmitting?: boolean;
  onDiscardDraft?: () => void;
}

export const PrescriptionCanvas = React.forwardRef<PrescriptionCanvasHandle, PrescriptionCanvasProps>(({ 
  onComplete, 
  onSkip, 
  onPrint, 
  doctor,
  clinic,
  patient,
  appointment,
  isSubmitting,
  onDiscardDraft
}, ref) => {
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);
  const {
    canvasRef,
    clearCanvas,
    undo,
    getFullBlob,
    getInkBlob,
    hasDrawing,
    addPage,
    addPageFromUrl,
    loadUrlToCurrentPage,
    setText,
    currentPageIndex,
    totalPages,
    setCurrentPageIndex,
    pages,
    isLoadingBackground,
    loadError,
    draftRestoredAt
  } = usePrescriptionDrawing({
    doctor,
    clinic,
    patient,
    appointment
  });

  React.useImperativeHandle(ref, () => ({
    addPageFromUrl,
    loadUrlToCurrentPage,
    setText
  }));

  const [isDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !('ontouchstart' in window) && navigator.maxTouchPoints === 0;
  });

  const currentText = pages[currentPageIndex]?.text || '';

  const handleSaveAction = async (type: 'complete' | 'print' = 'complete') => {
    if (!hasDrawing) {
      alert('Please write something before completing.');
      return;
    }

    try {
      const fullBlob = await getFullBlob();
      const inkBlob = await getInkBlob();
      if (!fullBlob || !inkBlob) return;

      if (type === 'complete') {
        onComplete(fullBlob, inkBlob);
      } else if (onPrint) {
        onPrint(fullBlob);
      }
    } catch (err: any) {
      console.error('Prescription Export Error:', err);
      alert(`Failed to export prescription: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full w-full bg-[#F8FAFC] select-none relative overflow-hidden group">
      
      {/* PAPER CONTAINER */}
      <div className="flex-1 h-full w-full relative overflow-hidden flex flex-col items-center justify-center p-4">
        <div className="h-[95%] max-h-full max-w-[95%] aspect-[1/1.414] relative bg-white shadow-xl rounded-md transition-transform duration-500 border border-slate-200 shrink-0">
          
          <PrescriptionPaperTemplate 
            doctor={doctor}
            clinic={clinic}
            patient={patient}
            appointment={appointment}
          />

          <canvas
            ref={canvasRef}
            style={{ touchAction: 'none', userSelect: 'none' }}
            className={cn(
                "touch-none select-none cursor-crosshair block w-full h-full absolute inset-0 z-10 bg-transparent",
                isDesktop && "pointer-events-none"
            )}
          />

          {isDesktop && (
            <div className="absolute inset-0 z-20 px-16 pt-[220px] pb-16 pointer-events-none">
              <textarea
                value={currentText}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type prescription here..."
                className="w-full h-full bg-transparent border-none outline-none resize-none font-sans text-lg font-medium text-slate-900 placeholder:text-slate-200 pointer-events-auto leading-relaxed"
                autoFocus
              />
            </div>
          )}
          
          {totalPages > 1 && (
            <div className="absolute top-4 right-4 bg-slate-900/5 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black text-slate-500 tracking-widest uppercase pointer-events-none z-30">
              Sheet {currentPageIndex + 1} of {totalPages}
            </div>
          )}

          {isLoadingBackground && (
            <div className="absolute inset-0 z-50 bg-white/40 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300">
               <RotateCcw className="h-10 w-10 text-primary animate-spin mb-4" />
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Retrieving Archive...</p>
            </div>
          )}

          {loadError && !isLoadingBackground && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-500 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
               <Pause className="h-3 w-3" />
               {loadError}
            </div>
          )}

          {draftRestoredAt && (
            <div className="absolute bottom-4 left-4 z-50 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2 rounded-2xl text-[10px] font-bold flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 shadow-2xl border border-white/10">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="tracking-tight">Restored work from {getClinic12hTimeString(new Date(draftRestoredAt))}</span>
               <button 
                onClick={onDiscardDraft}
                className="ml-2 text-white/40 hover:text-rose-400 transition-colors uppercase text-[9px] font-black"
               >
                 Discard
               </button>
            </div>
          )}
        </div>
      </div>

      {!isToolbarOpen && (
        <button
          onClick={() => setIsToolbarOpen(true)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center w-14 h-14 bg-slate-900 border border-slate-700 shadow-[0_15px_40px_rgba(0,0,0,0.3)] rounded-full hover:bg-black transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom flex-col"
        >
          <ChevronUp className="h-6 w-6 text-white mb-0.5" />
        </button>
      )}

      <div 
        className={cn(
          "absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center bg-white/95 backdrop-blur-3xl border border-slate-200 shadow-[0_25px_60px_rgba(0,0,0,0.15)] rounded-[2.5rem] p-3 gap-2 transition-all duration-500 origin-bottom",
          isToolbarOpen ? "translate-y-0 opacity-100 hover:scale-[1.02]" : "translate-y-[150%] opacity-0 pointer-events-none scale-90"
        )}
      >
        <button
          onClick={() => setIsToolbarOpen(false)}
          className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-700 ml-1"
        >
          <ChevronDown className="h-6 w-6" />
        </button>

        <div className="flex items-center gap-1 pl-1 pr-3 border-r border-slate-100">
          <button
            onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
            disabled={currentPageIndex === 0}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-20 transition-all"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <span className="text-[10px] font-black text-slate-400 w-8 text-center">{currentPageIndex + 1}</span>
          <button
            onClick={() => currentPageIndex === totalPages - 1 ? addPage() : setCurrentPageIndex(currentPageIndex + 1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-all"
          >
            {currentPageIndex === totalPages - 1 ? <PlusCircle className="h-5 w-5 text-blue-500" /> : <ChevronRight className="h-5 w-5 text-slate-600" />}
          </button>
        </div>

        {!isDesktop && (
          <button
            onClick={undo}
            disabled={!hasDrawing}
            className="flex flex-col items-center justify-center w-16 h-14 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all disabled:opacity-20"
          >
            <RotateCcw className="h-5 w-5 mb-1" />
            <span className="text-[9px] font-black uppercase tracking-tighter">Undo</span>
          </button>
        )}

        <button
          onClick={clearCanvas}
          className="flex flex-col items-center justify-center w-16 h-14 rounded-2xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
        >
          <Trash2 className="h-5 w-5 mb-1" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Clear</span>
        </button>

        <div className="w-[1px] h-10 bg-slate-100 mx-1" />

        <button
          onClick={onSkip}
          className="flex flex-col items-center justify-center w-16 h-14 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all"
        >
          <Pause className="h-5 w-5 mb-1" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Skip</span>
        </button>

        <button
          onClick={() => handleSaveAction('print')}
          className="flex flex-col items-center justify-center w-16 h-14 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all font-sans"
        >
          <Printer className="h-5 w-5 mb-1" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Print</span>
        </button>

        <button
          onClick={() => handleSaveAction('complete')}
          disabled={isSubmitting}
          className={cn(
            "flex items-center gap-4 h-14 px-8 rounded-[1.5rem] bg-slate-900 text-white shadow-xl shadow-slate-900/20 hover:bg-black active:scale-95 transition-all text-sm font-black tracking-tight",
            isSubmitting && "opacity-50 cursor-not-allowed"
          )}
        >
          {isSubmitting ? <RotateCcw className="h-5 w-5 animate-spin" /> : (
            <>
              <CheckCircle2 className="h-5 w-5 text-blue-400" />
              <span>Submit Prescription</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
});
