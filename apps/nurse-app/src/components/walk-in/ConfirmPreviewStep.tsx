'use client';

import { Loader2, Ticket, Clock, User, Hash, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { displayTime12h } from '@kloqo/shared-core';

interface ConfirmPreviewStepProps {
  isPreviewLoading: boolean;
  selectedPatient: any;
  walkInPreview: any;
  isSubmitting: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function ConfirmPreviewStep({
  isPreviewLoading,
  selectedPatient,
  walkInPreview,
  isSubmitting,
  onConfirm,
  onBack
}: ConfirmPreviewStepProps) {
  if (isPreviewLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-theme-blue" />
        <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Calculating Token Estimate...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Patient Info Summary */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
            <User className="h-6 w-6 text-slate-400" />
          </div>
          <div>
            <h2 className="font-black text-slate-800 leading-none">
              {selectedPatient?.patientName || selectedPatient?.name}
            </h2>
            <p className="text-xs font-bold text-slate-400 mt-1">
              {selectedPatient?.sex}, {selectedPatient?.age} Years
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack} className="text-theme-blue font-black text-[10px] uppercase">
          Change
        </Button>
      </div>

      {/* Token Preview Card */}
      <Card className="border-none shadow-xl shadow-theme-blue/10 overflow-hidden rounded-[40px] bg-white">
        <div className="bg-theme-blue p-8 text-white relative overflow-hidden">
          <Ticket className="absolute -bottom-6 -right-6 h-40 w-40 text-white/10 rotate-12" />
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-2">
              <Badge className="bg-white/20 text-white border-white/20 px-3 py-1 font-black uppercase text-[10px] tracking-widest">
                Estimated Token
              </Badge>
            </div>
            
            <div className="flex items-end gap-2">
              <span className="text-7xl font-black tracking-tighter leading-none">
                {walkInPreview?.placeholderAssignment?.numericToken || 
                 (walkInPreview?.placeholderAssignment?.tokenNumber?.split('-')[1]) || 
                 '??'}
              </span>
              <span className="text-2xl font-black opacity-50 mb-1">W</span>
            </div>

            <div className="pt-4 border-t border-white/20 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 opacity-60" />
                <span className="text-xs font-bold">
                  {walkInPreview?.placeholderAssignment?.slotTime 
                    ? displayTime12h(walkInPreview.placeholderAssignment.slotTime)
                    : 'Calculating...'
                  }
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 opacity-60" />
                <span className="text-xs font-bold">Session #{ (walkInPreview?.placeholderAssignment?.sessionIndex ?? 0) + 1 }</span>
              </div>
            </div>
          </div>
        </div>
        <CardContent className="p-8 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Queue Status</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-600">Clinical Wait Time</span>
                <span className="text-xs font-black text-slate-900">~ 20-30 Mins</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-600">Token Type</span>
                <span className="text-xs font-black text-theme-blue">Walk-in (General)</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100/50">
            <p className="text-[10px] leading-relaxed text-amber-700 font-bold">
              Note: This is an estimated token number based on the current queue. The actual token number will be assigned upon final confirmation.
            </p>
          </div>

          <Button 
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full h-16 rounded-3xl bg-black hover:bg-slate-900 text-white font-black text-lg shadow-xl shadow-black/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-6 w-6" />
                <span>Confirm & Allot Token</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
