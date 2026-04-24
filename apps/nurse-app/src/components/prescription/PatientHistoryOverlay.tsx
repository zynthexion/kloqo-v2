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
  Plus
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
import { format, isValid, isSameDay } from 'date-fns';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';

interface PatientHistoryOverlayProps {
  selectedAppointment: Appointment | null;
  clinicId: string;
  onAttach?: (url: string) => void;
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

export function PatientHistoryOverlay({ selectedAppointment, clinicId, onAttach }: PatientHistoryOverlayProps) {
  const { user } = useAuth();
  const { data: dashboardData } = useNurseDashboardContext();
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  
  // Filters
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

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
      // Reset filters on close
      setDoctorFilter('all');
      setDeptFilter('all');
      setSearchTerm('');
    }
  }, [isOpen, fetchHistory]);

  const filteredHistory = useMemo(() => {
    return history.filter(appt => {
      const matchesDoctor = doctorFilter === 'all' || appt.doctorId === doctorFilter;
      const matchesDept = deptFilter === 'all' || appt.department === deptFilter;
      const matchesSearch = !searchTerm || 
        appt.doctorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appt.department?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesDoctor && matchesDept && matchesSearch;
    });
  }, [history, doctorFilter, deptFilter, searchTerm]);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    history.forEach(a => {
      if (a.department) depts.add(a.department);
    });
    return Array.from(depts);
  }, [history]);

  const uniqueDoctors = useMemo(() => {
    const docs = new Map<string, string>();
    history.forEach(a => {
      if (a.doctorId && a.doctorName) docs.set(a.doctorId, a.doctorName);
    });
    return Array.from(docs.entries()).map(([id, name]) => ({ id, name }));
  }, [history]);

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
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Clinical Archive</h1>
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

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-4">
             <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search by doctor or dept..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
             </div>

             <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                <SelectTrigger className="w-[180px] h-12 rounded-2xl bg-slate-50 border-slate-100 font-bold text-slate-600">
                   <div className="flex items-center gap-2">
                      <User className="h-4 w-4 opacity-50" />
                      <SelectValue placeholder="Doctor" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">All Doctors</SelectItem>
                   {uniqueDoctors.map(doc => (
                     <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>
                   ))}
                </SelectContent>
             </Select>

             <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-[180px] h-12 rounded-2xl bg-slate-50 border-slate-100 font-bold text-slate-600">
                   <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 opacity-50" />
                      <SelectValue placeholder="Department" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">All Depts</SelectItem>
                   {departments.map(dept => (
                     <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                   ))}
                </SelectContent>
             </Select>

             <Button 
              variant="outline" 
              onClick={() => {
                setDoctorFilter('all');
                setDeptFilter('all');
                setSearchTerm('');
              }}
              className="h-12 w-12 rounded-2xl border-slate-100 hover:bg-slate-50 p-0"
              title="Reset Filters"
             >
                <Filter className="h-4 w-4 text-slate-400" />
             </Button>
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
                  const isOwnRx = appt.doctorId === user?.id;
                  
                  return (
                    <div 
                      key={appt.id}
                      className={cn(
                        "group bg-white rounded-[2rem] border-2 border-transparent p-6 transition-all duration-500 hover:shadow-xl hover:shadow-slate-200/50 flex flex-col relative",
                        isOwnRx ? "hover:border-primary/20" : "hover:border-slate-200"
                      )}
                    >
                      {isOwnRx && (
                        <div className="absolute top-0 right-8 px-3 py-1 bg-primary text-white text-[8px] font-black uppercase tracking-widest rounded-b-xl shadow-lg shadow-primary/20">
                           Your Rx
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                              <User className="h-5 w-5 text-slate-400" />
                           </div>
                           <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Physician</p>
                              <h4 className="font-black text-slate-800 text-sm tracking-tight">Dr. {appt.doctorName}</h4>
                           </div>
                        </div>
                        <div className="flex gap-2">
                           {isOwnRx && onAttach && (
                             <Button 
                              size="icon" 
                              variant="outline" 
                              title="Attach to Current Rx"
                              onClick={() => {
                                if (appt.prescriptionUrl) onAttach(appt.prescriptionUrl);
                              }}
                              className="h-8 w-8 rounded-lg border-slate-100 text-primary hover:bg-primary/5 hover:border-primary/20"
                             >
                               <Plus className="h-4 w-4" />
                             </Button>
                           )}
                           <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setViewerUrl(appt.prescriptionUrl || null)}
                            className="h-8 w-8 rounded-lg bg-slate-50 hover:bg-primary/10 hover:text-primary"
                           >
                             <Download className="h-4 w-4" />
                           </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-6">
                         <div className="p-3 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-2 text-slate-400 mb-1">
                               <Calendar className="h-3 w-3" />
                               <span className="text-[8px] font-black uppercase tracking-widest">Date</span>
                            </div>
                            <p className="text-xs font-black text-slate-700">
                               {completedAt ? format(completedAt, 'MMM d, yyyy') : 'N/A'}
                            </p>
                         </div>
                         <div className="p-3 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-2 text-slate-400 mb-1">
                               <Activity className="h-3 w-3" />
                               <span className="text-[8px] font-black uppercase tracking-widest">Dept</span>
                            </div>
                            <p className="text-xs font-black text-slate-700 truncate">
                               {appt.department || 'General'}
                            </p>
                         </div>
                      </div>

                      <Button 
                        onClick={() => setViewerUrl(appt.prescriptionUrl || null)}
                        className="w-full rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[9px] gap-2 border-none"
                      >
                         <FileText className="h-3 w-3" />
                         Preview Archive
                         <ChevronRight className="h-3 w-3 ml-auto opacity-30" />
                      </Button>
                    </div>
                  );
               })}
            </div>
          )}
        </div>

        {/* Prescription Viewer Layer */}
        {viewerUrl && (
          <div className="absolute inset-0 z-[100] bg-slate-900/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-300">
             <div className="flex items-center justify-between p-8">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-white/10 rounded-2xl">
                      <FileText className="h-6 w-6 text-white" />
                   </div>
                   <h2 className="text-xl font-black text-white tracking-tight">Prescription Review</h2>
                </div>
                <div className="flex items-center gap-4">
                   {onAttach && (
                     <Button 
                      onClick={() => {
                        onAttach(viewerUrl);
                        setViewerUrl(null);
                      }}
                      className="bg-primary text-white h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-2"
                     >
                       <Plus className="h-4 w-4" /> Attach to New Rx
                     </Button>
                   )}
                   <Button 
                    variant="ghost" 
                    onClick={() => setViewerUrl(null)}
                    className="h-12 w-12 rounded-2xl bg-white/10 text-white hover:bg-white/20"
                   >
                     <X className="h-5 w-5" />
                   </Button>
                </div>
             </div>
             <div className="flex-1 overflow-hidden p-8 flex items-center justify-center">
                <div className="relative h-full aspect-[1/1.414] bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-4xl">
                   <iframe 
                    src={viewerUrl} 
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
