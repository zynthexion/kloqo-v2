'use client';

import { format, subMinutes } from 'date-fns';
import { CalendarDays, Clock, Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getClinic12hTimeString } from '@kloqo/shared-core';

interface BookingSummaryViewProps {
  selectedDate: Date;
  selectedSlot: any;
  patient: any;
  booking: boolean;
  handleBook: (onSuccess: () => void) => void;
  onBack: () => void;
  onSuccess: () => void;
}

export function BookingSummaryView({ 
  selectedDate, selectedSlot, patient, booking, handleBook, onBack, onSuccess 
}: BookingSummaryViewProps) {
  return (
    <main className="flex-1 p-6 space-y-6 overflow-y-auto animate-in fade-in slide-in-from-right-4">
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-theme-blue/5 rounded-full -mr-20 -mt-20 blur-3xl" />
        
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-5 bg-theme-blue/10 rounded-[2rem] text-theme-blue">
            <Clock className="h-10 w-10" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">Review Details</h2>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Please confirm the slot</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 transition-colors hover:bg-slate-100/50">
            <div className="p-3 bg-white rounded-2xl shadow-sm">
              <CalendarDays className="h-5 w-5 text-theme-blue" />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Date & Time</label>
              <p className="text-base font-black text-slate-900">
                {format(selectedDate, 'EEEE, d MMMM')}
              </p>
              <p className="text-sm font-bold text-theme-blue">
                {getClinic12hTimeString(new Date(selectedSlot.time))}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 transition-colors hover:bg-slate-100/50">
            <div className="p-3 bg-white rounded-2xl shadow-sm">
              <Clock className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <label className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest block mb-0.5">Reporting Time</label>
              <p className="text-base font-black text-emerald-600">
                {getClinic12hTimeString(subMinutes(new Date(selectedSlot.time), 15))}
              </p>
              <p className="text-[10px] font-bold text-emerald-600/50 uppercase">Please arrive 15m early</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 transition-colors hover:bg-slate-100/50">
            <div className="p-3 bg-white rounded-2xl shadow-sm">
              <Phone className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Patient Details</label>
              <p className="text-base font-black text-slate-900 leading-tight">
                {patient?.name || 'Loading...'}
              </p>
              <p className="text-xs font-bold text-slate-500">{patient?.phone?.replace('+91', '') || 'No number'}</p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center px-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Consultation</span>
            <span className="text-sm font-black text-slate-900">Advanced Booking</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <Button
          onClick={() => handleBook(onSuccess)}
          disabled={booking}
          className="w-full h-16 rounded-[2rem] bg-theme-blue hover:bg-theme-blue/90 text-white font-black text-xl shadow-2xl shadow-theme-blue/20 transition-all active:scale-95"
        >
          {booking ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Confirm Appointment'}
        </Button>
        <Button
          onClick={onBack}
          variant="ghost"
          className="w-full h-12 rounded-2xl text-slate-400 font-black uppercase tracking-widest text-xs hover:bg-slate-100"
        >
          Change Date or Slot
        </Button>
      </div>
    </main>
  );
}
