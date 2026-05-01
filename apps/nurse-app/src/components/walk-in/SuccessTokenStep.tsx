'use client';

import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessTokenStepProps {
  confirmedAppointment: any;
  doctorInfo: any;
  onReturn: () => void;
  onAnother: () => void;
}

export function SuccessTokenStep({
  confirmedAppointment,
  doctorInfo,
  onReturn,
  onAnother
}: SuccessTokenStepProps) {
  return (
    <div className="space-y-8 py-10 animate-in fade-in zoom-in-95 duration-700">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center border-4 border-white shadow-xl shadow-green-100">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        </div>
        <h2 className="text-3xl font-black text-slate-900">Success!</h2>
        <p className="text-slate-500 font-bold max-w-[240px]">Token successfully generated for the patient.</p>
      </div>

      {/* Physical Token Card Design */}
      <div className="mx-auto max-w-[280px] bg-white rounded-[40px] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden p-8 flex flex-col items-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Official Token</p>
        <div className="w-full h-px bg-slate-100 mb-6" />
        
        <h3 className="text-[10px] font-black text-theme-blue uppercase tracking-widest mb-1">
          Dr. {doctorInfo?.name}
        </h3>
        
        <div className="flex items-end gap-1 my-6">
          <span className="text-8xl font-black tracking-tighter text-slate-900">
            {confirmedAppointment.numericToken}
          </span>
          <span className="text-3xl font-black text-slate-300 mb-2">W</span>
        </div>

        <div className="w-full space-y-3 pt-6 border-t border-slate-100">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400 uppercase tracking-widest">Patient</span>
            <span className="text-slate-900 truncate max-w-[120px]">{confirmedAppointment.patientName}</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400 uppercase tracking-widest">Time</span>
            <span className="text-slate-900 uppercase">{confirmedAppointment.time}</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400 uppercase tracking-widest">Date</span>
            <span className="text-slate-900">{confirmedAppointment.date}</span>
          </div>
        </div>

        <div className="mt-8 flex gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-200" />
          <div className="w-2 h-2 rounded-full bg-slate-200" />
          <div className="w-2 h-2 rounded-full bg-slate-200" />
        </div>
      </div>

      <div className="space-y-3 px-4">
        <Button 
          onClick={onReturn}
          className="w-full h-14 rounded-3xl bg-black text-white font-black shadow-xl"
        >
          Return to Dashboard
        </Button>
        <Button 
          variant="ghost"
          onClick={onAnother}
          className="w-full h-14 rounded-3xl text-slate-400 font-black text-xs uppercase tracking-widest"
        >
          Register Another Walk-in
        </Button>
      </div>
    </div>
  );
}
