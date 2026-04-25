import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Download, 
  Loader2, 
  FileText,
  Activity,
  ChevronRight,
  X,
  Link,
  Plus,
  Copy,
  AlertTriangle,
  Lock
} from 'lucide-react';
import { Appointment, Doctor } from '@kloqo/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { format, isValid, isSameDay } from 'date-fns';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';

interface PatientHistoryOverlayProps {
  selectedAppointment: Appointment | null;
  clinicId: string;
  onAttach?: (url: string) => void;
  onDuplicate?: (url: string) => void;
}

function toDate(val: any): Date | null {
  if (!val) return null;
  try {
    if (val?.toDate && typeof val.toDate === 'function') {
      return val.toDate();
    }
    if (typeof val._seconds === 'number') {
      const d = new Date(val._seconds * 1000);
      return isValid(d) ? d : null;
    }
    const d = new Date(val);
    return isValid(d) ? d : null;
  } catch (e) {
    return null;
  }
}

export function PatientHistoryOverlay({ selectedAppointment, clinicId, onAttach, onDuplicate }: PatientHistoryOverlayProps) {
  const { user } = useAuth();
  const { activeRole, clinicalProfile } = useActiveIdentity();
  const { data: dashboardData } = useNurseDashboardContext();
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHistoryAppt, setSelectedHistoryAppt] = useState<Appointment | null>(null);

  const patientId = selectedAppointment?.patientId;
  const patientName = selectedAppointment?.patientName;
  const disabled = !selectedAppointment;

  const fetchHistory = useCallback(async () => {
    if (!patientId || !clinicId) return;
    setLoading(true);
    try {
      const data = await apiRequest<Appointment[]>(
        `/prescriptions/patient/${patientId}?clinicId=${clinicId}`
      );
      setHistory(data || []);
    } catch (e) {
      console.error('Failed to fetch patient history', e);
    } finally {
      setLoading(false);
    }
  }, [patientId, clinicId]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    } else {
      setSelectedHistoryAppt(null);
    }
  }, [isOpen, fetchHistory]);

  const filteredHistory = useMemo(() => {
    const userId = user?.id || user?.uid;
    const currentDoctorId = activeRole === 'doctor' ? clinicalProfile?.id : null;

    return history.filter(appt => {
      // 1. If active role is DOCTOR, they ONLY see their own prescriptions
      if (activeRole === 'doctor') {
        const isAuthor = appt.doctorId === currentDoctorId || appt.doctorId === userId;
        if (!isAuthor) return false;
      }

      // 2. Status filter (Case-insensitive check)
      const status = appt.status?.toLowerCase();
      if (status !== 'prescribed' && status !== 'completed') return false;

      return true;
    });
  }, [history, user, activeRole, clinicalProfile]);

  const handleDuplicateAction = (appt: Appointment) => {
    if (!appt.rawInkUrl || appt.rawInkUrl.toLowerCase().endsWith('.pdf')) {
      alert("This is a legacy PDF prescription. Digital duplication (copying handwriting) is only available for newer prescriptions.\n\nYou can still view this record in the archive.");
      return;
    }
    if (!onDuplicate) return;

    if (!appt.isInkIsolated) {
      const proceed = window.confirm("This prescription was created before isolated ink was supported. Duplicating may show an old date or patient info.\n\nDo you want to proceed?");
      if (!proceed) return;
    }
    onDuplicate(appt.rawInkUrl);
    setIsOpen(false);
  };

  const handleAttachAction = (appt: Appointment) => {
    if (!appt.rawInkUrl || appt.rawInkUrl.toLowerCase().endsWith('.pdf')) {
      alert("Legacy PDF prescriptions cannot be attached to the current canvas. Only digital handwriting can be attached.");
      return;
    }
    if (!onAttach) return;

    if (!appt.isInkIsolated) {
      const proceed = window.confirm("Note: This is an older prescription. Attaching it will include the old date and patient info.\n\nContinue?");
      if (!proceed) return;
    }
    onAttach(appt.rawInkUrl);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          disabled={disabled}
          className={cn(
            "rounded-2xl gap-3 border-white bg-white/60 backdrop-blur-md shadow-premium hover:bg-white transition-all font-bold px-6 h-12",
            disabled ? "opacity-40 cursor-not-allowed" : "text-primary hover:scale-[1.02] active:scale-95"
          )}
          title={disabled ? "Select a patient first" : "View patient Rx history"}
        >
          <ClipboardList className="h-5 w-5" />
          <span className="uppercase tracking-widest text-xs">Rx History</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden border-none bg-[#F8FAFC] shadow-2xl rounded-[3rem]">
        {/* Header Section */}
        <div className="px-10 py-8 bg-white border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-primary/10 rounded-[1.5rem] flex items-center justify-center">
                <ClipboardList className="h-8 w-8 text-primary" />
              </div>
              <div>
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Clinical Archive</DialogTitle>
                </DialogHeader>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  History for <span className="text-primary">{patientName}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <span className="px-4 py-2 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-slate-100">
                  {filteredHistory.length} Records
               </span>
               <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsOpen(false)}
                className="rounded-full h-10 w-10 hover:bg-slate-100"
               >
                 <X className="h-5 w-5 text-slate-400" />
               </Button>
            </div>
          </div>


        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Accessing History...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
              <FileText className="h-12 w-12 text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No Historical Data Found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
               {filteredHistory.map((appt) => {
                  const completedAt = toDate(appt.completedAt);
                  return (
                    <div 
                      key={appt.id}
                      className="group bg-white rounded-[2rem] border-2 border-slate-100/50 p-8 transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50 flex flex-col relative overflow-hidden"
                    >
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                           <Calendar className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Prescribed On</p>
                           <h4 className="font-black text-slate-800 text-lg tracking-tight">
                              {completedAt ? format(completedAt, 'MMMM d, yyyy') : 'N/A'}
                           </h4>
                        </div>
                      </div>

                      <Button 
                        onClick={() => setSelectedHistoryAppt(appt)}
                        className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest text-[10px] gap-3 shadow-xl shadow-slate-200 transition-all active:scale-95"
                      >
                         <FileText className="h-4 w-4 text-blue-400" />
                         Preview Archive
                         <ChevronRight className="h-4 w-4 ml-auto opacity-30" />
                      </Button>
                    </div>
                  );
               })}
            </div>
          )}
        </div>

        {/* Prescription Viewer Layer */}
        {selectedHistoryAppt && (
          <div className="absolute inset-0 z-[100] bg-slate-900/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-300">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 border-b border-white/10 flex-shrink-0 bg-slate-900/50">
                 {/* Left: Info */}
                 <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2.5 bg-white/10 rounded-xl hidden md:flex flex-shrink-0">
                       <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div className="overflow-hidden">
                       <h2 className="text-base font-black text-white tracking-tight leading-none truncate">Prescription Review</h2>
                       <div className="flex items-center gap-2 mt-1.5">
                          <p className="text-[9px] font-black text-white/40 uppercase tracking-widest truncate">
                             {selectedHistoryAppt.completedAt ? format(toDate(selectedHistoryAppt.completedAt)!, 'MMMM d, yyyy') : 'N/A'}
                          </p>
                          <span className={cn(
                            "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter",
                            (!selectedHistoryAppt.rawInkUrl || selectedHistoryAppt.rawInkUrl.toLowerCase().endsWith('.pdf'))
                              ? "bg-amber-500/10 text-amber-500" 
                              : "bg-emerald-500/10 text-emerald-500"
                          )}>
                            {(!selectedHistoryAppt.rawInkUrl || selectedHistoryAppt.rawInkUrl.toLowerCase().endsWith('.pdf')) ? 'Legacy PDF' : 'Digital Ink'}
                          </span>
                       </div>
                    </div>
                 </div>

                 {/* Center: Navigation */}
                 <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 mx-4">
                    <Button 
                     variant="ghost" 
                     size="icon"
                     disabled={filteredHistory.indexOf(selectedHistoryAppt) <= 0}
                     onClick={() => {
                       const idx = filteredHistory.indexOf(selectedHistoryAppt);
                       if (idx > 0) setSelectedHistoryAppt(filteredHistory[idx - 1]);
                     }}
                     className="h-8 w-8 rounded-xl text-white hover:bg-white/10 disabled:opacity-10 transition-all"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </Button>
                    <div className="flex flex-col items-center min-w-[50px]">
                       <span className="text-[10px] font-black text-primary px-2 tracking-widest">
                          {filteredHistory.indexOf(selectedHistoryAppt) + 1} / {filteredHistory.length}
                       </span>
                    </div>
                    <Button 
                     variant="ghost" 
                     size="icon"
                     disabled={filteredHistory.indexOf(selectedHistoryAppt) >= filteredHistory.length - 1}
                     onClick={() => {
                       const idx = filteredHistory.indexOf(selectedHistoryAppt);
                       if (idx < filteredHistory.length - 1) setSelectedHistoryAppt(filteredHistory[idx + 1]);
                     }}
                     className="h-8 w-8 rounded-xl text-white hover:bg-white/10 disabled:opacity-10 transition-all"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                 </div>

                 {/* Right: Actions */}
                 <div className="flex items-center gap-2 justify-end">
                    {onDuplicate && (
                      <Button 
                       onClick={() => handleDuplicateAction(selectedHistoryAppt)}
                       disabled={!selectedHistoryAppt.rawInkUrl || selectedHistoryAppt.rawInkUrl.toLowerCase().endsWith('.pdf')}
                       className="bg-white text-slate-900 hover:bg-slate-50 h-10 px-4 rounded-xl font-black uppercase tracking-widest text-[8px] gap-1.5 border-none shadow-lg transition-all active:scale-95 disabled:opacity-30 disabled:bg-white/10 disabled:text-white"
                      >
                         {!selectedHistoryAppt.rawInkUrl || selectedHistoryAppt.rawInkUrl.toLowerCase().endsWith('.pdf') ? (
                           <Lock className="h-3 w-3 text-white/30" />
                         ) : !selectedHistoryAppt.isInkIsolated ? (
                           <AlertTriangle className="h-3 w-3 text-orange-500" />
                         ) : (
                           <Copy className="h-3 w-3 text-primary" />
                         )}
                         Duplicate
                      </Button>
                    )}
                    {onAttach && (
                      <Button 
                       onClick={() => handleAttachAction(selectedHistoryAppt)}
                       disabled={!selectedHistoryAppt.rawInkUrl || selectedHistoryAppt.rawInkUrl.toLowerCase().endsWith('.pdf')}
                       className="bg-primary text-white hover:bg-primary/90 h-10 px-4 rounded-xl font-black uppercase tracking-widest text-[8px] gap-1.5 shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-30"
                      >
                        <Plus className="h-3.5 w-3.5" /> Attach
                      </Button>
                    )}
                    <Button 
                     variant="ghost" 
                     size="icon"
                     onClick={() => setSelectedHistoryAppt(null)}
                     className="h-10 w-10 rounded-xl bg-white/10 text-white hover:bg-white/20 ml-1"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                 </div>
              </div>
             <div className="flex-1 overflow-hidden p-8 flex items-center justify-center">
                <div className="relative h-full aspect-[1/1.414] bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-4xl">
                   <iframe 
                    src={selectedHistoryAppt.prescriptionUrl} 
                    className="w-full h-full border-none"
                    title="Prescription Preview"
                   />
                </div>
             </div>
          </div>
        )}

        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
