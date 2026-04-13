'use client';

import React, { useState } from 'react';
import { Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PatientHistoryOverlay } from '@/components/prescription/PatientHistoryOverlay';
import { Appointment } from '@kloqo/shared';

interface TabletFocusLayoutProps {
  children: React.ReactNode;
  queue: React.ReactNode;
  selectedAppointment?: Appointment | null;
  clinicId?: string;
}

export function TabletFocusLayout({ children, queue, selectedAppointment, clinicId }: TabletFocusLayoutProps) {
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden font-sans">
      {/* Sub-header for Action Buttons (Top Right) */}
      <div className="absolute top-4 right-8 z-40 flex items-center gap-3">
        {/* Patient History Button */}
        {clinicId && (
          <PatientHistoryOverlay
            selectedAppointment={selectedAppointment || null}
            clinicId={clinicId}
          />
        )}
        {/* Live Queue Button */}
        <Button 
          variant="outline" 
          size="lg" 
          onClick={() => setIsQueueOpen(true)}
          className="rounded-2xl gap-3 border-white bg-white/60 backdrop-blur-md shadow-premium hover:bg-white transition-all text-primary font-bold px-6 h-12"
        >
          <div className="relative">
            <Users className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border-2 border-white animate-pulse" />
          </div>
          <span className="uppercase tracking-widest text-xs">Live Tokens</span>
        </Button>
      </div>

      {/* Main Rx Canvas Area (Centered Paper Effect) */}
      <main className="flex-1 relative overflow-hidden flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl h-[95%] bg-white shadow-premium rounded-[2.5rem] border border-white/50 overflow-hidden relative transition-all duration-500 group">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-50 opacity-30 pointer-events-none" />
          <div className="h-full w-full relative z-10">
            {children}
          </div>
        </div>
      </main>

      {/* Queue Overlay (Sidebar-like Modern Popup) */}
      {isQueueOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-end p-6 bg-slate-900/20 backdrop-blur-md animate-in fade-in duration-500"
          onClick={() => setIsQueueOpen(false)}
        >
          <div 
            className="w-full max-w-md h-full bg-white/80 backdrop-blur-2xl rounded-[3rem] shadow-premium overflow-hidden flex flex-col border border-white/40 animate-in slide-in-from-right-8 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 border-b border-white/20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary shadow-lg shadow-primary/20 rounded-[1.25rem]">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="flex flex-col">
                  <h2 className="font-black text-xl text-slate-900 leading-tight">Patient Queue</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Arrived & Waiting</p>
                </div>
              </div>
              <button 
                onClick={() => setIsQueueOpen(false)}
                className="p-3 hover:bg-slate-100 rounded-2xl transition-all duration-300 group"
              >
                <X className="h-6 w-6 text-slate-400 group-hover:rotate-90 group-hover:text-slate-900 transition-all" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {queue}
            </div>

            <div className="p-8 bg-slate-50/50 border-t border-white/20">
              <Button 
                variant="ghost" 
                onClick={() => setIsQueueOpen(false)}
                className="w-full h-14 rounded-2xl text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all"
              >
                Return to Prescription
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .tablet-portrait-optimized .fixed.bottom-0 {
          display: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}


