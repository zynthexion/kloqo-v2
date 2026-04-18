'use client';

import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Command, 
  CommandGroup, 
  CommandItem, 
  CommandList, 
  CommandEmpty 
} from "@/components/ui/command";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Search, 
  Loader2, 
  Link as LinkIcon, 
  Plus, 
  UserPlus, 
  UserCheck, 
  Crown 
} from "lucide-react";
import { 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { UseFormReturn } from "react-hook-form";
import type { AppointmentFormValues } from "@/hooks/use-appointments-page";

interface PatientDirectoryProps {
  form: UseFormReturn<AppointmentFormValues>;
  state: {
    patientSearchTerm: string;
    patientSearchResults: any[];
    isPatientPopoverOpen: boolean;
    selectedPatient: any;
    primaryPatient: any;
    bookingFor: 'member' | 'relative';
    relatives: any[];
    isPending: boolean;
    isSendingLink: boolean;
    isDrawerExpanded: boolean;
    doctors: any[];
    hasSelectedOption: boolean;
  };
  actions: {
    setIsPatientPopoverOpen: (open: boolean) => void;
    setSelectedPatient: (patient: any) => void;
    setPrimaryPatient: (patient: any) => void;
    setHasSelectedOption: (has: boolean) => void;
    setBookingFor: (type: 'member' | 'relative') => void;
    setIsAddRelativeDialogOpen: (open: boolean) => void;
    setIsDrawerExpanded: (expanded: boolean) => void;
    handlePatientSearch: (term: string) => void;
    handlePatientSelect: (patient: any) => void;
    handleRelativeSelect: (relative: any) => void;
    handlePatientSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSendLink: () => void;
  };
  patientInputRef: React.RefObject<HTMLInputElement>;
}

export function PatientDirectory({ form, state, actions, patientInputRef }: PatientDirectoryProps) {
  const {
    patientSearchTerm,
    patientSearchResults,
    selectedPatient,
    primaryPatient,
    isPending,
    isSendingLink,
  } = state;

  const {
    setSelectedPatient,
    setHasSelectedOption,
    setIsAddRelativeDialogOpen,
    handlePatientSelect,
    handlePatientSearchChange,
    handleSendLink
  } = actions;

  const showSuggestions = patientSearchTerm.length >= 3 && !selectedPatient;

  return (
    <div className="space-y-6">
      {/* Step 1: Patient Search Input */}
      <div className="space-y-4">
        <FormItem>
          <FormLabel className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Search Patient by Phone</FormLabel>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <FormControl>
              <Input
                ref={patientInputRef}
                placeholder="Start typing 10-digit phone number..."
                value={patientSearchTerm}
                onChange={handlePatientSearchChange}
                className="h-14 pl-11 pr-32 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all font-bold text-lg"
                maxLength={10}
              />
            </FormControl>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isPending && <Loader2 className="h-4 w-4 animate-spin text-blue-500 mr-2" />}
              <Button 
                type="button" 
                variant="ghost"
                size="sm"
                onClick={handleSendLink} 
                disabled={isSendingLink || patientSearchTerm.length < 10}
                className="h-10 px-3 rounded-xl text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50"
              >
                {isSendingLink ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <LinkIcon className="h-3.5 w-3.5 mr-2" />}
                Send Link
              </Button>
            </div>
          </div>
          <FormMessage />
        </FormItem>
      </div>

      {/* Step 2: Member Suggestions (Inline Cards) */}
      {showSuggestions && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Matches Found</label>
            <div className="h-px w-full bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {patientSearchResults.map((patient, idx) => {
              const isPrimary = patient.phone === `+91${patientSearchTerm}` || patient.phone === patientSearchTerm;
              return (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => handlePatientSelect(patient)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 bg-white border-2 rounded-2xl transition-all text-left group relative overflow-hidden",
                    selectedPatient?.id === patient.id 
                      ? "border-blue-600 bg-blue-50/30 ring-4 ring-blue-50" 
                      : "border-slate-50 hover:border-blue-200 hover:bg-slate-50/50"
                  )}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <Avatar className="h-12 w-12 border-2 border-white shadow-sm shrink-0">
                    <AvatarFallback className={cn(
                      "font-black text-lg text-white",
                      isPrimary ? "bg-slate-900" : "bg-blue-500"
                    )}>
                      {patient.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-black text-slate-900 truncate">{patient.name || 'Unnamed Patient'}</p>
                      {isPrimary && <Badge className="h-4 p-0 px-1 bg-amber-100 text-[8px] text-amber-700 hover:bg-amber-100 border-none">Member</Badge>}
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold tracking-tight uppercase flex items-center gap-2">
                       <span>{patient.sex || 'N/A'}</span>
                       <span className="w-1 h-1 rounded-full bg-slate-300" />
                       <span>{patient.age || '?'} YRS</span>
                    </p>
                  </div>
                </button>
              );
            })}

            {/* Add New Logic */}
            {!primaryPatient && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPatient(null);
                  setHasSelectedOption(true);
                  form.reset({
                    ...form.getValues(),
                    patientName: "",
                    age: undefined,
                    sex: "Male",
                    phone: patientSearchTerm,
                    place: "",
                    bookedVia: "Advanced Booking",
                  });
                }}
                className="w-full flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50/30 transition-all group"
              >
                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors shrink-0">
                  <UserPlus className="h-6 w-6 text-slate-400 group-hover:text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-500 group-hover:text-blue-700 uppercase tracking-widest">New Patient</p>
                  <p className="text-[9px] font-bold text-slate-400 group-hover:text-blue-500 uppercase">Register {patientSearchTerm}</p>
                </div>
              </button>
            )}

            {primaryPatient && (
              <button 
                type="button"
                onClick={() => setIsAddRelativeDialogOpen(true)}
                className="w-full flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/30 transition-all group"
              >
                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors shrink-0">
                  <Plus className="h-6 w-6 text-slate-400 group-hover:text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-500 group-hover:text-emerald-700 uppercase tracking-widest">Add Relative</p>
                  <p className="text-[9px] font-bold text-slate-400 group-hover:text-emerald-500 uppercase">For {primaryPatient.name}</p>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Selected Patient Mini-Profile (When chosen) */}
      {selectedPatient && (
        <div className="p-4 bg-blue-50/50 border-2 border-blue-100/50 rounded-2xl flex items-center justify-between group animate-in zoom-in-95 duration-300">
           <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                <AvatarFallback className="bg-blue-600 text-white font-black text-lg">
                  {selectedPatient.name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-base font-black text-slate-900 leading-tight">{selectedPatient.name}</p>
                <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mt-0.5">
                  Selected Profile
                </p>
              </div>
           </div>
           <Button 
            type="button"
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setSelectedPatient(null);
              setHasSelectedOption(false);
            }}
            className="rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-red-500 hover:bg-red-50"
           >
             Change
           </Button>
        </div>
      )}
    </div>
  );
}
