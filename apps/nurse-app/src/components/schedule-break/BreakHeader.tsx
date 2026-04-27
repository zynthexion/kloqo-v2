import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Coffee, AlertTriangle } from 'lucide-react';
import { Stage } from '@/hooks/useScheduleBreak';

interface BreakHeaderProps {
  stage: Stage;
  onBack: () => void;
  doctors?: any[];
  selectedDoctorId?: string;
  onDoctorChange?: (id: string) => void;
}

import { ChevronDown } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export const BreakHeader: React.FC<BreakHeaderProps> = ({ 
  stage, 
  onBack,
  doctors = [],
  selectedDoctorId,
  onDoctorChange
}) => {
  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  return (
    <header className="flex items-center gap-4 p-4 bg-amber-500 text-white rounded-b-3xl shadow-lg sticky top-0 z-10 transition-all duration-300">
      <Button
        onClick={onBack}
        variant="ghost" size="icon"
        className="hover:bg-white/10 text-white rounded-xl"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <div className="flex-1">
        {selectedDoctor && stage === 'SELECT' ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-start group outline-none">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg font-black leading-tight tracking-tight uppercase group-hover:text-amber-100 transition-colors">
                    {selectedDoctor.name}
                  </h1>
                  <ChevronDown className="w-4 h-4 text-amber-200 group-hover:text-white transition-all group-data-[state=open]:rotate-180" />
                </div>
                <p className="text-[10px] font-black text-amber-100 uppercase tracking-[0.2em] opacity-80">
                  Scheduling Break
                </p>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px] rounded-[1.5rem] p-2 bg-white/95 backdrop-blur-md border-amber-100 shadow-2xl">
              {doctors.map((doc) => (
                <DropdownMenuItem 
                  key={doc.id}
                  onClick={() => onDoctorChange?.(doc.id)}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-amber-50 focus:bg-amber-50 group"
                >
                  <Avatar className="w-8 h-8 border-2 border-amber-100">
                    <AvatarImage src={doc.image} />
                    <AvatarFallback className="bg-amber-100 text-amber-600 text-[10px] font-black">
                      {doc.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight group-hover:text-amber-600 transition-colors">
                      {doc.name}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                      {doc.specialty || 'Practitioner'}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <h1 className="text-lg font-black leading-tight tracking-tight uppercase">
              {stage === 'SELECT'  && 'Schedule Break'}
              {stage === 'PREVIEW' && 'Review Impact'}
              {stage === 'DONE'    && 'Break Confirmed'}
            </h1>
            <p className="text-[10px] font-black text-amber-100 uppercase tracking-[0.2em] opacity-80">
              {stage === 'SELECT'  && 'Select your break window'}
              {stage === 'PREVIEW' && 'Confirm before committing'}
              {stage === 'DONE'    && 'Redirecting to dashboard...'}
            </p>
          </>
        )}
      </div>
      <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/10 shadow-inner">
        {stage === 'PREVIEW' ? <AlertTriangle className="h-5 w-5 animate-pulse" /> : <Coffee className="h-5 w-5" />}
      </div>
    </header>
  );
};
