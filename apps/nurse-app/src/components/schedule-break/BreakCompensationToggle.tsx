import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface BreakCompensationToggleProps {
  mode: 'GAP_ABSORPTION' | 'FULL_COMPENSATION';
  onModeChange: (checked: boolean) => void;
}

export const BreakCompensationToggle: React.FC<BreakCompensationToggleProps> = ({
  mode,
  onModeChange
}) => {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner">
      <div className="flex-1 pr-4">
        <Label htmlFor="comp-mode" className="text-xs font-black text-slate-800 uppercase tracking-widest block mb-1">
          Full Compensation?
        </Label>
        <p className="text-[10px] text-slate-400 font-bold leading-tight uppercase tracking-tight">
          {mode === 'FULL_COMPENSATION' 
            ? 'YES: Shift all tokens for 100% rest' 
            : 'NO: Absorb gaps to reduce delay'}
        </p>
      </div>
      <Switch 
        id="comp-mode"
        checked={mode === 'FULL_COMPENSATION'}
        onCheckedChange={onModeChange}
        className="data-[state=checked]:bg-amber-500"
      />
    </div>
  );
};
