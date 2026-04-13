import React from 'react';
import { RotateCcw, Trash2, Pause, Printer, CheckCircle2 } from 'lucide-react';
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
  const {
    canvasRef,
    clearCanvas,
    getBlob,
    hasDrawing,
    pointerHandlers
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
    <div className="flex flex-col h-full w-full bg-white select-none relative group overflow-hidden shadow-inner">
      <canvas
        ref={canvasRef}
        {...pointerHandlers}
        className="flex-1 touch-none cursor-crosshair bg-white"
      />

      {/* CLINICAL CONTROLS (OPTIMIZED FOR S-PEN) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center bg-white/95 backdrop-blur-2xl border border-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[2rem] p-3 gap-3 transition-all duration-300">
        <button
          onClick={clearCanvas}
          className="flex flex-col items-center justify-center w-20 h-16 rounded-2xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all font-sans"
        >
          <Trash2 className="h-6 w-6 mb-1" />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Clear</span>
        </button>

        <div className="w-[1px] h-10 bg-slate-200 mx-1" />

        <button
          onClick={onSkip}
          className="flex flex-col items-center justify-center w-20 h-16 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all font-sans"
        >
          <Pause className="h-6 w-6 mb-1" />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Skip</span>
        </button>

        <button
          onClick={() => handleSaveAction('print')}
          className="flex flex-col items-center justify-center w-20 h-16 rounded-2xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all font-sans"
        >
          <Printer className="h-6 w-6 mb-1" />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Print</span>
        </button>

        <button
          onClick={() => handleSaveAction('complete')}
          disabled={isSubmitting}
          className={cn(
            "flex items-center gap-4 h-16 px-8 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all text-base font-black font-sans",
            isSubmitting && "opacity-50 cursor-not-allowed"
          )}
        >
          {isSubmitting ? (
             <RotateCcw className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="h-6 w-6 stroke-[3px]" />
              <div className="flex flex-col items-start leading-none">
                <span className="uppercase tracking-[0.2em] text-[10px] opacity-70 font-black">Finalize</span>
                <span>Submit Rx</span>
              </div>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
