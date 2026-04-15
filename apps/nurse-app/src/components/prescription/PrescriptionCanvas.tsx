import React, { useState } from 'react';
import { RotateCcw, Trash2, Pause, Printer, CheckCircle2, ChevronLeft, ChevronRight, PlusCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Doctor, Clinic, Patient, Appointment } from '@kloqo/shared';
import { usePrescriptionDrawing } from '@/hooks/usePrescriptionDrawing';

interface PrescriptionCanvasProps {
  onComplete: (blob: Blob) => void;
  onSkip?: () => void;
  onPrint?: (blob: Blob) => void;
  doctor: Doctor;
  clinic: Clinic;
  patient: Patient;
  appointment: Appointment;
  isSubmitting?: boolean;
}

export function PrescriptionCanvas({ 
  onComplete, 
  onSkip, 
  onPrint, 
  doctor,
  clinic,
  patient,
  appointment,
  isSubmitting 
}: PrescriptionCanvasProps) {
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);
  const {
    canvasRef,
    clearCanvas,
    undo,
    getBlob,
    hasDrawing,
    addPage,
    currentPageIndex,
    totalPages,
    setCurrentPageIndex
  } = usePrescriptionDrawing({
    doctor,
    clinic,
    patient,
    appointment
  });

  const handleSaveAction = async (type: 'complete' | 'print' = 'complete') => {
    if (!hasDrawing) {
      alert('Please write something before completing.');
      return;
    }

    const blob = await getBlob();
    if (!blob) return;

    if (type === 'complete') {
      onComplete(blob);
    } else if (onPrint) {
      onPrint(blob);
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
            <div className="w-full h-40 flex items-start justify-between relative mb-8">
              <div className="absolute top-0 right-0 w-[40%] h-full bg-slate-50 [clip-path:polygon(15%_0,100%_0,100%_100%,0_100%)] z-0" />
              <div className="w-[65%] h-full bg-[#3ebfb2] [clip-path:polygon(0_0,100%_0,85%_100%,0_100%)] px-12 py-10 flex flex-col z-10 text-white">
                <h1 className="text-4xl font-extrabold tracking-wide">Dr. {doctor.name}</h1>
                <p className="text-white/90 tracking-widest text-sm mt-2 uppercase font-semibold">
                  {doctor.department || 'OB/GYN'}
                </p>
                <p className="text-white/70 tracking-widest text-xs mt-1 uppercase font-semibold">
                  {doctor.specialty || 'SPECIALTY'}
                </p>
              </div>
              
              <div className="relative z-10 w-[30%] h-full flex items-center justify-end pr-12">
                <img src="/Kloqo_Logo_full (2) (1).webp" className="w-36 object-contain mix-blend-multiply opacity-80" alt="Logo" />
              </div>
            </div>

            {/* Patient Grid Component */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-4 px-16 w-full border-b border-slate-100 pb-8 mb-8">
               <div className="flex text-sm"><span className="text-slate-500 font-bold w-24 uppercase tracking-widest text-xs mt-0.5">Name:</span> <span className="font-semibold text-slate-900">{patient.name}</span></div>
               <div className="flex text-sm"><span className="text-slate-500 font-bold w-24 uppercase tracking-widest text-xs mt-0.5">Weight:</span> <span className="font-semibold text-slate-900">{patient.weight ? `${patient.weight} Kg` : '-'}</span></div>
               <div className="flex text-sm"><span className="text-slate-500 font-bold w-24 uppercase tracking-widest text-xs mt-0.5">Age:</span> <span className="font-semibold text-slate-900">{patient.age ?? appointment.age ?? 'N/A'} Y</span></div>
               <div className="flex text-sm"><span className="text-slate-500 font-bold w-24 uppercase tracking-widest text-xs mt-0.5">Height:</span> <span className="font-semibold text-slate-900">{patient.height ? `${patient.height} cm` : '-'}</span></div>
               <div className="flex text-sm"><span className="text-slate-500 font-bold w-24 uppercase tracking-widest text-xs mt-0.5">Gender:</span> <span className="font-semibold text-slate-900">{patient.sex ?? (appointment as any).sex ?? 'N/A'}</span></div>
               <div className="flex text-sm"><span className="text-slate-500 font-bold w-24 uppercase tracking-widest text-xs mt-0.5">Date:</span> <span className="font-semibold text-slate-900">{new Date().toLocaleDateString('en-GB')}</span></div>
               <div className="flex text-sm"><span className="text-slate-500 font-bold w-24 uppercase tracking-widest text-xs mt-0.5">Contact:</span> <span className="font-semibold text-slate-900">{patient.communicationPhone || patient.phone || '-'}</span></div>
            </div>

            {/* Huge Rx Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40%] text-slate-100/60 text-[25rem] font-serif font-black select-none z-0 tracking-tighter">
              Rx
            </div>

            {/* Signature Area */}
            <div className="absolute bottom-32 right-16 w-48 border-t-2 border-slate-700 text-center pt-2">
              <span className="text-sm font-semibold text-slate-700">Signature</span>
            </div>

            {/* Footer Bottom Block */}
            <div className="absolute bottom-0 left-0 right-0 h-24 flex items-center px-16 border-t border-slate-100 bg-white z-0">
              <div className="flex gap-10 items-center text-slate-600 text-xs font-semibold tracking-wider">
                <span className="text-slate-800 font-extrabold text-lg tracking-widest uppercase">{clinic.name}</span>
                {clinic.address && (
                  <span className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3ebfb2]"></div> {clinic.address}
                  </span>
                )}
              </div>
            </div>
            
          </div>

          {/* SINGLE CANVAS — Incremental drawing, zero race conditions */}
          <canvas
            ref={canvasRef}
            style={{ touchAction: 'none', userSelect: 'none' }}
            className="touch-none select-none cursor-crosshair block w-full h-full absolute inset-0 z-10 bg-transparent"
          />
          
          {/* PAGE INDICATOR OVERLAY */}
          {totalPages > 1 && (
            <div className="absolute top-4 right-4 bg-slate-900/5 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black text-slate-500 tracking-widest uppercase pointer-events-none">
              Sheet {currentPageIndex + 1} of {totalPages}
            </div>
          )}

          {/* BOTTOM RIGHT NEXT PAGE TRIGGER */}
          <button 
            onClick={() => currentPageIndex === totalPages - 1 ? addPage() : setCurrentPageIndex(currentPageIndex + 1)}
            className="absolute bottom-4 right-4 w-16 h-16 flex items-center justify-center bg-blue-500/5 hover:bg-blue-500/10 rounded-tl-3xl border-t border-l border-blue-500/20 group/page"
          >
            <div className="flex flex-col items-center gap-1 opacity-40 group-hover/page:opacity-100 transition-opacity">
               <PlusCircle className="h-5 w-5 text-blue-600" />
               <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter">Next Sheet</span>
            </div>
          </button>
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

        <button
          onClick={undo}
          disabled={!hasDrawing}
          className="flex flex-col items-center justify-center w-16 h-14 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all disabled:opacity-20"
          title="Undo Last Stroke"
        >
          <RotateCcw className="h-5 w-5 mb-1" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Undo</span>
        </button>

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
}
