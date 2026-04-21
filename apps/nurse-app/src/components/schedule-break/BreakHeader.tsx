import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Coffee, AlertTriangle } from 'lucide-react';
import { Stage } from '@/hooks/useScheduleBreak';

interface BreakHeaderProps {
  stage: Stage;
  onBack: () => void;
}

export const BreakHeader: React.FC<BreakHeaderProps> = ({ stage, onBack }) => {
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
      </div>
      <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/10 shadow-inner">
        {stage === 'PREVIEW' ? <AlertTriangle className="h-5 w-5 animate-pulse" /> : <Coffee className="h-5 w-5" />}
      </div>
    </header>
  );
};
