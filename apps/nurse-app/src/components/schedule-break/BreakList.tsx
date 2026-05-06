import React from 'react';
import { Coffee, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BreakPeriod } from '@kloqo/shared';
import { displayTime12h } from '@kloqo/shared-core';

interface BreakListProps {
  breaks: BreakPeriod[];
  onCancel: (breakId: string) => void;
  isCancelling: boolean;
}

export const BreakList: React.FC<BreakListProps> = ({ breaks, onCancel, isCancelling }) => {
  if (!breaks || breaks.length === 0) return null;

  return (
    <div className="space-y-3 px-4 mb-6">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Existing Breaks</label>
      <div className="space-y-2">
        {breaks.map((b) => (
          <div 
            key={b.id} 
            className="bg-white border-2 border-slate-100 rounded-3xl p-4 flex items-center justify-between group hover:border-amber-200 transition-all shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Coffee className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                   <Clock className="h-3 w-3 text-slate-400" />
                   <p className="text-sm font-black text-slate-800">
                     {displayTime12h(b.startTimeFormatted || b.startTime)} – {displayTime12h(b.endTimeFormatted || b.endTime)}
                   </p>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Session {b.sessionIndex + 1} • {b.duration} mins
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              disabled={isCancelling}
              onClick={() => onCancel(b.id)}
              className="h-10 w-10 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
