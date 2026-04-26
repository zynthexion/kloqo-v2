import React, { useState } from 'react';
import { RotateCcw, Trash2, Pause, Printer, CheckCircle2, ChevronLeft, ChevronRight, PlusCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Doctor, Clinic, Patient, Appointment } from '@kloqo/shared';
import { usePrescriptionDrawing } from '@/hooks/usePrescriptionDrawing';

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
}

export const PrescriptionCanvas = React.forwardRef<PrescriptionCanvasHandle, PrescriptionCanvasProps>(({ 
  onComplete, 
  onSkip, 
  onPrint, 
  doctor,
  clinic,
  patient,
  appointment,
  isSubmitting 
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
    pages
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

    const fullBlob = await getFullBlob();
    const inkBlob = await getInkBlob();
    if (!fullBlob || !inkBlob) return;

    if (type === 'complete') {
      onComplete(fullBlob, inkBlob);
    } else if (onPrint) {
      onPrint(fullBlob);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full w-full bg-[#F8FAFC] select-none relative overflow-hidden group">
      
      {/* PAPER CONTAINER */}
      <div className="flex-1 h-full w-full relative overflow-hidden flex flex-col items-center justify-center p-4">
        <div className="h-[95%] max-h-full max-w-[95%] aspect-[1/1.414] relative bg-white shadow-xl rounded-md transition-transform duration-500 border border-slate-200 shrink-0">
          
          {/* HTML UNDERLAY TEMPLATE */}
          <div className="absolute inset-0 z-0 flex flex-col pointer-events-none select-none bg-white overflow-hidden rounded-md">
            
            {/* Geometric Header Component */}
            <div className="w-full h-28 flex items-start justify-between relative mb-4">
              <div className="absolute top-0 right-0 w-[35%] h-full bg-slate-50 [clip-path:polygon(15%_0,100%_0,100%_100%,0_100%)] z-0" />
              <div className="w-[75%] h-full bg-[#3ebfb2] [clip-path:polygon(0_0,100%_0,85%_100%,0_100%)] px-12 py-3 flex flex-col justify-center z-10 text-white">
                <h1 className="text-2xl font-extrabold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis shrink-0">Dr. {doctor.name}</h1>
                <p className="text-white/90 tracking-widest text-[11px] mt-1 uppercase font-semibold truncate shrink-0">
                  {doctor.department || 'OB/GYN'}
                </p>
                <p className="text-white/70 tracking-widest text-[9px] mt-0.5 uppercase font-semibold shrink-0">
                  {doctor.specialty || 'SPECIALTY'}
                </p>
              </div>
              
              <div className="relative z-10 w-[30%] h-full flex items-center justify-end pr-12">
                <img src="/Kloqo_Logo_full (2) (1).webp" className="w-28 object-contain mix-blend-multiply opacity-80" alt="Logo" />
              </div>
            </div>

            <div className="w-full border-b border-slate-100 pb-3 mb-3 px-12">
              <div className="grid grid-cols-2 gap-x-12 gap-y-1 w-full">
                 <div className="flex text-xs items-center"><span className="text-slate-500 font-bold w-14 shrink-0 uppercase tracking-widest text-[10px]">Name:</span> <span className="font-semibold text-slate-900 truncate">{patient.name}</span></div>
                 <div className="flex text-xs items-center"><span className="text-slate-500 font-bold w-14 shrink-0 uppercase tracking-widest text-[10px]">Date:</span> <span className="font-semibold text-slate-900 truncate">{new Date().toLocaleDateString('en-GB')}</span></div>
                 
                 <div className="flex text-xs items-center"><span className="text-slate-500 font-bold w-14 shrink-0 uppercase tracking-widest text-[10px]">Age:</span> <span className="font-semibold text-slate-900 truncate">{patient.age ?? appointment.age ?? 'N/A'} Y</span></div>
                 <div className="flex text-xs items-center"><span className="text-slate-500 font-bold w-14 shrink-0 uppercase tracking-widest text-[10px]">Contact:</span> <span className="font-semibold text-slate-900 truncate">{patient.communicationPhone || patient.phone || '-'}</span></div>
                 
                 <div className="flex text-xs items-center"><span className="text-slate-500 font-bold w-14 shrink-0 uppercase tracking-widest text-[10px]">Gender:</span> <span className="font-semibold text-slate-900 truncate">{patient.sex ?? (appointment as any).sex ?? 'N/A'}</span></div>
                 <div className="flex text-xs items-center"></div>
              </div>
            </div>

            {/* Huge Rx Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40%] text-slate-100/60 text-[25rem] font-serif font-black select-none z-0 tracking-tighter">
              Rx
            </div>

            {/* Signature Area */}
            <div className="absolute bottom-16 right-16 w-48 border-t-2 border-slate-700 text-center pt-2">
              <span className="text-sm font-semibold text-slate-700">Signature</span>
            </div>

            {/* Footer Bottom Block */}
            <div className="absolute bottom-0 left-0 right-0 py-2 flex flex-col items-center justify-center border-t border-slate-100 bg-white z-0">
              <span className="text-slate-800 font-bold text-[10px] tracking-widest uppercase">{clinic.name}</span>
              {clinic.address && (
                <span className="text-slate-500 text-[8px] font-medium leading-tight mt-0.5">{clinic.address}</span>
              )}
              {clinic.phone && (
                <span className="text-slate-500 text-[8px] font-medium leading-tight mt-0.5">Ph: {clinic.phone}</span>
              )}
            </div>
          </div>

          {/* SINGLE CANVAS — Incremental drawing, zero race conditions */}
          <canvas
            ref={canvasRef}
            style={{ touchAction: 'none', userSelect: 'none' }}
            className={cn(
                "touch-none select-none cursor-crosshair block w-full h-full absolute inset-0 z-10 bg-transparent",
                isDesktop && "pointer-events-none"
            )}
          />

          {/* DESKTOP TYPING OVERLAY */}
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
          
          {/* PAGE INDICATOR OVERLAY */}
          {totalPages > 1 && (
            <div className="absolute top-4 right-4 bg-slate-900/5 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black text-slate-500 tracking-widest uppercase pointer-events-none z-30">
              Sheet {currentPageIndex + 1} of {totalPages}
            </div>
          )}


        </div>
      </div>

      {/* TOOLBAR TOGGLE (When Hidden) */}
      {!isToolbarOpen && (
        <button
          onClick={() => setIsToolbarOpen(true)}
          title="Restore Toolbar"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center w-14 h-14 bg-slate-900 border border-slate-700 shadow-[0_15px_40px_rgba(0,0,0,0.3)] rounded-full hover:bg-black transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom flex-col"
        >
          <ChevronUp className="h-6 w-6 text-white mb-0.5" />
        </button>
      )}

      {/* REFINED FLOATING TOOLBAR */}
      <div 
        className={cn(
          "absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center bg-white/95 backdrop-blur-3xl border border-slate-200 shadow-[0_25px_60px_rgba(0,0,0,0.15)] rounded-[2.5rem] p-3 gap-2 transition-all duration-500 origin-bottom",
          isToolbarOpen ? "translate-y-0 opacity-100 hover:scale-[1.02]" : "translate-y-[150%] opacity-0 pointer-events-none scale-90"
        )}
      >
        
        <button
          onClick={() => setIsToolbarOpen(false)}
          className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-700 ml-1"
          title="Hide Toolbar"
        >
          <ChevronDown className="h-6 w-6" />
        </button>

        {/* PAGE NAVIGATION */}
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
            title="Undo Last Stroke"
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
          {isSubmitting ? (
             <RotateCcw className="h-5 w-5 animate-spin" />
          ) : (
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
