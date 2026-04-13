'use client';

import { Calendar, Clock } from 'lucide-react';
import { format, subMinutes, parse } from 'date-fns';
import { formatDate, formatDayOfWeek } from '@/lib/date-utils';
import { useLanguage } from '@/contexts/language-context';
import type { Doctor } from '@kloqo/shared';

interface SlotInfoProps {
  doctor: Doctor | null;
  selectedSlot: Date | null;
  loading: boolean;
}

function findSessionEndTime(doctor: Doctor | null, selectedSlot: Date | null): string | null {
  if (!doctor || !selectedSlot) return null;
  const dayOfWeek = format(selectedSlot, 'EEEE');
  const slot = doctor.availabilitySlots?.find((s: any) => s.day === dayOfWeek);
  if (!slot?.timeSlots) return null;

  for (const session of slot.timeSlots) {
    try {
      const start = parse(session.from, 'hh:mm a', selectedSlot);
      const end = parse(session.to, 'hh:mm a', selectedSlot);
      if (selectedSlot >= start && selectedSlot <= end) {
        return format(subMinutes(end, 15), 'hh:mm a');
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

export function SlotInfo({ doctor, selectedSlot, loading }: SlotInfoProps) {
  const { language } = useLanguage();
  if (loading || !selectedSlot) return null;

  const endTime = findSessionEndTime(doctor, selectedSlot);

  return (
    <div className="border-t pt-6 space-y-4">
      <div className="flex items-center gap-4 group">
        <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-theme-blue/5 transition-colors">
          <Calendar className="w-5 h-5 text-theme-blue" strokeWidth={2.5} />
        </div>
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Appointment Date</span>
          <span className="font-black text-slate-800 text-sm tracking-tight capitalize">
            {formatDayOfWeek(selectedSlot, language)}, {format(selectedSlot, 'dd')} {formatDate(selectedSlot, 'MMMM', language)}, {format(selectedSlot, 'yyyy')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 group">
        <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-theme-blue/5 transition-colors">
          <Clock className="w-5 h-5 text-theme-blue" strokeWidth={2.5} />
        </div>
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Session Time Arrive By</span>
          <span className="font-black text-slate-800 text-sm tracking-tight">
            {format(subMinutes(selectedSlot, 15), 'hh:mm a')}
            {endTime && <span className="text-slate-300 mx-2">to</span>}
            {endTime && <span>{endTime}</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
