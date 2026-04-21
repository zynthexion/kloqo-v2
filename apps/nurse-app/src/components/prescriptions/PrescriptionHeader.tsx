import React from 'react';
import { FileText, LogOut } from 'lucide-react';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';

interface PrescriptionHeaderProps {
  clinicName: string;
  userName: string;
  onLogout: () => void;
}

export const PrescriptionHeader: React.FC<PrescriptionHeaderProps> = ({
  clinicName,
  userName,
  onLogout
}) => {
  return (
    <header className="sticky top-0 z-40 bg-theme-blue text-white px-6 py-4 md:py-6 shadow-2xl transition-all duration-300">
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-60 h-60 bg-white rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner group transition-all hover:scale-110">
            <FileText className="h-6 w-6 group-hover:rotate-12 transition-transform" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-black tracking-tight leading-none">
               FULFILLMENT CENTER
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                Live Dashboard &bull; {clinicName || 'Operational Mode'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 p-2 bg-black/10 backdrop-blur-3xl rounded-[1.5rem] border border-white/10 shadow-2xl">
          <div className="hidden lg:flex flex-col items-end pr-4 border-r border-white/10 pl-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Pharmacist Session</span>
            <span className="text-xs font-bold">{userName || 'Clinical Staff'}</span>
          </div>
          
          <div className="w-full md:w-56 text-slate-900 drop-shadow-xl">
            <RoleSwitcher />
          </div>

          <button 
            onClick={onLogout}
            className="p-3 bg-rose-500 hover:bg-rose-600 active:scale-90 text-white rounded-2xl shadow-lg shadow-rose-900/40 transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
