import React from 'react';
import { Doctor, Clinic, Patient, Appointment } from '@kloqo/shared';

interface PrescriptionPaperTemplateProps {
  doctor: Doctor;
  clinic: Clinic;
  patient: Patient;
  appointment: Appointment;
}

export const PrescriptionPaperTemplate: React.FC<PrescriptionPaperTemplateProps> = ({
  doctor,
  clinic,
  patient,
  appointment
}) => {
  return (
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
  );
};
