import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Link as LinkIcon, Clock } from 'lucide-react';

interface PatientSearchBannerProps {
  phoneNumber: string;
  setPhoneNumber: (val: string) => void;
  isSearchingPatient: boolean;
  isSendingLink: boolean;
  handleSendLink: () => void;
  nextSlotHint: { date: string, time: string, reportingTime: string } | null;
  onSearch: (phone: string) => void;
}

export const PatientSearchBanner: React.FC<PatientSearchBannerProps> = ({
  phoneNumber,
  setPhoneNumber,
  isSearchingPatient,
  isSendingLink,
  handleSendLink,
  nextSlotHint,
  onSearch
}) => {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-theme-blue/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-theme-blue/10 transition-colors" />
      
      <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">Search Patient</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 border-r border-slate-200 pr-3">+91</span>
          <Input
            type="tel"
            placeholder="Phone number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
            onKeyDown={(e) => e.key === 'Enter' && onSearch(phoneNumber)}
            className="pl-16 bg-slate-50 border-slate-100 h-14 rounded-2xl text-xl font-black placeholder:text-slate-300 focus:ring-theme-blue/20"
            maxLength={10}
          />
          {isSearchingPatient && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 className="h-5 w-5 animate-spin text-theme-blue" />
            </div>
          )}
        </div>
        <Button
          onClick={handleSendLink}
          variant="outline"
          disabled={isSendingLink || phoneNumber.length !== 10}
          className="h-14 w-14 rounded-2xl border-theme-blue text-theme-blue hover:bg-theme-blue hover:text-white transition-all shadow-sm"
          title="Send WhatsApp Link"
        >
          {isSendingLink ? <Loader2 className="h-5 w-5 animate-spin" /> : <LinkIcon className="h-6 w-6" />}
        </Button>
      </div>

      {!phoneNumber && nextSlotHint && (
        <div className="mt-6 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/50 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-emerald-500 shadow-lg shadow-emerald-200 p-3 rounded-2xl">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-widest leading-none mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Next Available
            </p>
            <p className="text-base font-black text-emerald-900 leading-tight">
              {nextSlotHint.date} @ {nextSlotHint.time}
            </p>
            <p className="text-[10px] text-emerald-600/70 font-bold mt-1 uppercase tracking-tight">Report by {nextSlotHint.reportingTime}</p>
          </div>
        </div>
      )}
    </div>
  );
};
