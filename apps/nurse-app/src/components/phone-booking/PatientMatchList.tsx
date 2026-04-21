import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock, UserPlus, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PatientMatchListProps {
  phoneNumber: string;
  searchedPatients: any[];
  selectedPatient: any | null;
  onSelectPatient: (p: any) => void;
  primaryPatient: any | null;
  setIsAddRelativeDialogOpen: (open: boolean) => void;
  linkPendingPatients: any[];
  showForm: boolean;
}

export const PatientMatchList: React.FC<PatientMatchListProps> = ({
  phoneNumber,
  searchedPatients,
  selectedPatient,
  onSelectPatient,
  primaryPatient,
  setIsAddRelativeDialogOpen,
  linkPendingPatients,
  showForm
}) => {
  const primaryMatches = searchedPatients.filter(p => (p.phone === `+91${phoneNumber}` || p.phone === phoneNumber));
  const familyMatches = searchedPatients.filter(p => (p.phone !== `+91${phoneNumber}` && p.phone !== phoneNumber));

  return (
    <div className="space-y-6">
      {/* Primary Matches Section */}
      {primaryMatches.length > 0 && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between px-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Primary Members
            </label>
            <div className="h-[2px] flex-1 bg-slate-100 ml-4 rounded-full" />
          </div>
          
          <div className="grid gap-3">
            {primaryMatches.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => onSelectPatient(p)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 bg-white border-2 rounded-3xl transition-all text-left group relative overflow-hidden",
                  selectedPatient?.id === p.id 
                    ? "border-theme-blue bg-blue-50/30 ring-4 ring-theme-blue/5" 
                    : "border-slate-50 hover:border-theme-blue/30 hover:bg-slate-50/50"
                )}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <Avatar className="h-14 w-14 border-2 border-white shadow-md ring-1 ring-slate-100">
                  <AvatarFallback className="bg-gradient-to-br from-theme-blue to-blue-600 text-white font-black text-xl">
                    {p.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-lg font-black text-slate-900 leading-none">{p.name || 'Unknown'}</p>
                    <span className="text-[10px] font-black bg-theme-blue/10 text-theme-blue px-2 py-0.5 rounded-full uppercase">Account</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold tracking-tight uppercase flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded-md text-slate-700">{p.sex || 'N/A'}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>{p.age || '?'} Years</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>{p.place || 'No location'}</span>
                  </p>
                </div>
                {selectedPatient?.id === p.id && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-theme-blue p-1.5 rounded-full shadow-lg shadow-theme-blue/20">
                    <Clock className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Relatives Match Section */}
      {(familyMatches.length > 0 || primaryPatient) && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 pt-2">
          <div className="flex items-center justify-between px-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Family & Relatives
            </label>
            <div className="h-[2px] flex-1 bg-slate-100 ml-4 rounded-full" />
          </div>
          
          <div className="grid gap-3">
            {familyMatches.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => onSelectPatient(p)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 bg-white border-2 rounded-3xl transition-all text-left group relative overflow-hidden",
                  selectedPatient?.id === p.id 
                    ? "border-theme-blue bg-blue-50/30 ring-4 ring-theme-blue/5" 
                    : "border-slate-50 hover:border-theme-blue/30 hover:bg-slate-50/50"
                )}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-1 ring-slate-100 opacity-80">
                  <AvatarFallback className="bg-slate-100 text-slate-400 font-black text-lg">
                    {p.name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-base font-black text-slate-900">{p.name || 'Unknown'}</p>
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">Family</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold tracking-tight uppercase flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded-md">{p.sex || 'N/A'}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>{p.age || '?'} Years</span>
                  </p>
                </div>
                {selectedPatient?.id === p.id && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-theme-blue p-1 rounded-full">
                    <Clock className="h-2 w-2 text-white" />
                  </div>
                )}
              </button>
            ))}
            
            {primaryPatient && (
              <button 
                onClick={() => setIsAddRelativeDialogOpen(true)}
                className="w-full flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-3xl hover:border-theme-blue hover:bg-blue-50/30 transition-all group"
              >
                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-theme-blue/10 transition-colors">
                  <UserPlus className="h-6 w-6 text-slate-400 group-hover:text-theme-blue" />
                </div>
                <p className="text-sm font-black text-slate-500 group-hover:text-theme-blue uppercase tracking-widest">
                  Add Family Member
                </p>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Awaiting Booking Section */}
      {!showForm && linkPendingPatients.length > 0 && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 pt-4">
          <div className="flex items-center justify-between px-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Awaiting Booking ({linkPendingPatients.length})
            </label>
            <div className="h-[2px] flex-1 bg-slate-100 ml-4 rounded-full" />
          </div>
          <div className="grid gap-3">
            {linkPendingPatients.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-3xl shadow-sm">
                <div>
                  <p className="text-sm font-black text-slate-900">{p.phone}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Link sent - No appointment</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-emerald-100 text-emerald-600 hover:bg-emerald-50"
                  onClick={() => window.location.href = `tel:${p.phone}`}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
