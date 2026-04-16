'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  X, 
  ClipboardList, 
  Download, 
  Loader2, 
  Clock, 
  ChevronLeft, 
  Calendar,
  User,
  Activity,
  ChevronRight,
  FileText
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api-client';
import { Appointment } from '@kloqo/shared';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';

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

export default function PatientHistoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const patientId = params.patientId as string;
  const patientName = searchParams.get('name') || 'Patient';
  const clinicId = user?.clinicId;

  const [history, setHistory] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

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
    fetchHistory();
  }, [fetchHistory]);

  const headerActions = (
    <Button
      variant="ghost"
      onClick={() => router.push('/dashboard')}
      className="rounded-2xl gap-2 text-slate-500 hover:text-slate-900 font-black uppercase tracking-widest text-xs h-12 px-6"
    >
      <ChevronLeft className="h-5 w-5" />
      Back to Dashboard
    </Button>
  );

  return (
    <TabletDashboardLayout collapsed noPadding headerActions={headerActions}>
      <div className="flex flex-col h-full bg-[#F8FAFC]">
        {/* Sub-header with Patient Info */}
        <div className="px-10 py-12 bg-white border-b border-slate-100">
            <div className="max-w-5xl mx-auto flex items-end justify-between">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center shadow-sm">
                        <ClipboardList className="h-10 w-10 text-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Prescription History</h1>
                            <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                                {history.length} Records Found
                            </span>
                        </div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">Patient Identity: <span className="text-slate-600 font-black">{patientName}</span></p>
                    </div>
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
            <div className="max-w-5xl mx-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Retrieving Clinical Archives...</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <FileText className="h-10 w-10 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900">No Historical Records</h3>
                        <p className="text-slate-400 mt-2 max-w-xs text-center font-medium">We couldn't find any previous prescriptions for this patient in your clinic's history.</p>
                        <Button 
                            onClick={() => router.push('/dashboard')}
                            className="mt-8 rounded-2xl px-8 h-12 bg-slate-900 hover:bg-black font-black uppercase tracking-widest text-[10px]"
                        >
                            Return to Dashboard
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                        {history.map((appt, idx) => {
                            const completedAt = toDate(appt.completedAt);
                            const isOwnRx = appt.doctorId === user?.id;
                            
                            return (
                                <div 
                                    key={appt.id}
                                    onClick={() => setViewerUrl(appt.prescriptionUrl || null)}
                                    className={cn(
                                        "group relative bg-white rounded-[2.5rem] border-2 border-transparent p-8 transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50 cursor-pointer overflow-hidden",
                                        isOwnRx ? "hover:border-primary/20" : "hover:border-slate-200"
                                    )}
                                >
                                    {isOwnRx && (
                                        <div className="absolute top-0 right-0 px-6 py-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">
                                            Your Rx
                                        </div>
                                    )}

                                    <div className="flex items-start justify-between mb-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                                                <User className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Physician</p>
                                                <h4 className="font-black text-slate-800 tracking-tight">Dr. {appt.doctorName}</h4>
                                            </div>
                                        </div>
                                        <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="rounded-full bg-slate-50 group-hover:bg-primary/10 group-hover:text-primary transition-all"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setViewerUrl(appt.prescriptionUrl || null);
                                            }}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Calendar className="h-3 w-3" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Date</span>
                                            </div>
                                            <p className="text-sm font-black text-slate-700">
                                                {completedAt ? format(completedAt, 'MMM d, yyyy') : 'Unknown Date'}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl space-y-1">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Clock className="h-3 w-3" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Time</span>
                                            </div>
                                            <p className="text-sm font-black text-slate-700">
                                                {completedAt ? format(completedAt, 'hh:mm a') : '--:--'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-emerald-500" />
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Verified Session</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-primary scale-0 group-hover:scale-100 transition-transform origin-right">
                                            <span className="text-[10px] font-black uppercase tracking-widest">View Rx</span>
                                            <ChevronRight className="h-4 w-4" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Full-Page Image Viewer */}
      {viewerUrl && (
        <div
          className="fixed inset-0 z-[500] bg-slate-900/95 backdrop-blur-3xl flex flex-col p-8"
          onClick={() => setViewerUrl(null)}
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                 <div className="p-3 bg-white/10 rounded-2xl">
                    <ClipboardList className="h-6 w-6 text-white" />
                 </div>
                 <h2 className="text-2xl font-black text-white tracking-tight">Document Inspection</h2>
            </div>
            <div className="flex items-center gap-4">
                <a
                    href={viewerUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 bg-white text-slate-900 px-8 h-14 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl"
                    onClick={e => e.stopPropagation()}
                >
                    <Download className="h-5 w-5" /> Download Archive
                </a>
                <Button 
                    variant="ghost" 
                    onClick={() => setViewerUrl(null)}
                    className="h-14 w-14 rounded-2xl bg-white/10 text-white hover:bg-white/20"
                >
                    <X className="h-6 w-6" />
                </Button>
            </div>
          </div>
          <div
            className="flex-1 overflow-hidden flex items-center justify-center relative p-10 bg-white/5 rounded-[4rem] border border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={viewerUrl}
              alt="Prescription"
              className="max-w-full max-h-full rounded-2xl object-contain shadow-[0_0_100px_rgba(0,0,0,0.5)]"
            />
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </TabletDashboardLayout>
  );
}
