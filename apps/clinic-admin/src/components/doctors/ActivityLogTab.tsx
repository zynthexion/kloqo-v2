"use client";

import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  CalendarDays, 
  Clock, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  FileText
} from "lucide-react";
import { apiRequest } from '@/lib/api-client';
import { format } from 'date-fns';
import { Doctor } from '@kloqo/shared';
import { cn } from '@/lib/utils';

// We'll define the interface locally or import it if shared package is updated
interface LocalActivityLog {
  id: string;
  type: string;
  action: string;
  doctorId: string;
  clinicId: string;
  performedBy: { id: string; name: string; role: string };
  details: Record<string, any>;
  timestamp: string | Date;
}

interface ActivityLogTabProps {
  doctor: Doctor;
}

export function ActivityLogTab({ doctor }: ActivityLogTabProps) {
  const [logs, setLogs] = useState<LocalActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<LocalActivityLog[]>(`/doctors/${doctor.id}/activities?clinicId=${doctor.clinicId}&limit=50`);
        setLogs(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch activity logs');
      } finally {
        setLoading(false);
      }
    }

    if (doctor.id) {
      fetchLogs();
    }
  }, [doctor.id, doctor.clinicId]);

  const getActionBadge = (action: string) => {
    const label = action.replace(/_/g, ' ');
    switch (action) {
      case 'SCHEDULE_BREAK':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none uppercase text-[10px] font-black tracking-widest px-3">Session Pause</Badge>;
      case 'CANCEL_BREAK':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none uppercase text-[10px] font-black tracking-widest px-3">Pause Revoked</Badge>;
      case 'UPDATE_LEAVE':
      case 'MARK_LEAVE':
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none uppercase text-[10px] font-black tracking-widest px-3">Clinical Leave</Badge>;
      case 'UPDATE_WEEKLY_AVAILABILITY':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none uppercase text-[10px] font-black tracking-widest px-3">Structural Shift</Badge>;
      default:
        return <Badge variant="outline" className="uppercase text-[10px] font-black tracking-widest px-3">{label}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 animate-pulse">
        <Loader2 className="h-10 w-10 animate-spin text-theme-blue/30 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Retrieving Clinical Audit Trail...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-rose-50 border border-rose-100 rounded-[3rem] p-10 flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-xl shadow-rose-200/50">
          <AlertCircle className="h-8 w-8 text-rose-500" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black text-rose-900 uppercase tracking-tight">Audit Retrieval Offline</h3>
          <p className="text-xs text-rose-600 font-bold max-w-xs">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card className="border-none shadow-premium-dark rounded-[3.5rem] bg-white overflow-hidden p-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="space-y-2">
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-theme-blue animate-pulse" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrative Accountability</span>
             </div>
             <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Activity Log<span className="text-theme-blue">.</span></h2>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="rounded-2xl px-6 py-3 bg-slate-50 text-slate-500 font-black text-[10px] uppercase tracking-widest border-slate-100">
              {logs.length} Log Entries Found
            </Badge>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6 bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
             <div className="w-24 h-24 rounded-[2.5rem] bg-white flex items-center justify-center shadow-xl shadow-black/5">
                <FileText className="w-12 h-12 text-slate-100" />
             </div>
             <div className="text-center space-y-1">
               <p className="text-xs font-black uppercase tracking-widest text-slate-400">Pristine Accountability</p>
               <p className="text-[10px] font-bold text-slate-300 uppercase italic">No scheduling mutations detected for this practitioner</p>
             </div>
          </div>
        ) : (
          <div className="relative space-y-6 after:absolute after:left-[27px] after:top-14 after:bottom-14 after:w-0.5 after:bg-slate-50 after:-z-0">
            {logs.map((log) => (
              <div key={log.id} className="group relative flex items-start gap-10 p-8 rounded-[3rem] hover:bg-slate-50/80 transition-all duration-500 z-10 border border-transparent hover:border-slate-100">
                {/* Timeline Marker */}
                <div className={cn(
                  "mt-1 w-14 h-14 rounded-3xl flex items-center justify-center shadow-premium transition-all duration-500 group-hover:scale-105 shrink-0 z-10 bg-white border border-slate-50",
                  log.action.includes('CANCEL') || log.action.includes('REVOKE') ? "text-rose-500" : "text-emerald-500"
                )}>
                  {log.action.includes('CANCEL') || log.action.includes('REVOKE') ? <AlertCircle className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                </div>

                <div className="flex-1 space-y-6">
                  <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                    <div className="space-y-2">
                       <div className="flex flex-wrap items-center gap-3">
                        <span className="text-lg font-black text-slate-900 tracking-tight uppercase">
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        {getActionBadge(log.action)}
                      </div>
                      <div className="flex items-center gap-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-slate-300" />
                          {format(new Date(log.timestamp), 'h:mm a')}
                        </div>
                        <div className="h-1.5 w-1.5 bg-slate-200 rounded-full" />
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-300" />
                          {format(new Date(log.timestamp), 'dd MMM, yyyy')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-[1.5rem] border border-slate-100 shadow-xl shadow-black/5 self-start group-hover:shadow-theme-blue/5 transition-all">
                       <div className="w-9 h-9 rounded-2xl bg-slate-900 flex items-center justify-center text-xs text-white font-black shadow-lg shadow-slate-900/20">
                         {log.performedBy.name[0]}
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{log.performedBy.name}</span>
                         <span className="text-[9px] font-black text-theme-blue uppercase tracking-widest">{log.performedBy.role}</span>
                       </div>
                    </div>
                  </div>

                  {log.details && (
                    <div className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100 group-hover:bg-white transition-all duration-500 grid grid-cols-2 lg:grid-cols-4 gap-8">
                      {Object.entries(log.details).map(([key, value]) => (
                        <div key={key} className="space-y-1.5">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] leading-none">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          <p className="text-xs font-black text-slate-700 truncate leading-none">
                            {typeof value === 'boolean' ? (value ? 'YES' : 'NO') : String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-4 px-12 py-6 bg-slate-900/5 rounded-[2.5rem] border border-slate-900/5">
        <AlertCircle className="w-5 h-5 text-slate-400" />
        <div className="space-y-0.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Compliance Notice</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase italic">
            Clinical audit trail is immutable and retained for 90 days for regulatory oversight.
          </p>
        </div>
      </div>
    </div>
  );
}
