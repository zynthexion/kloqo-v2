'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, ClipboardList, Search, Download, Loader2, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api-client';
import { Appointment } from '@kloqo/shared';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PatientHistoryOverlayProps {
  selectedAppointment: Appointment | null;
  clinicId: string;
}

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val?.toDate) return val.toDate();
  return new Date(val);
}

export function PatientHistoryOverlay({ selectedAppointment, clinicId }: PatientHistoryOverlayProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const patientId = selectedAppointment?.patientId;
  const patientName = selectedAppointment?.patientName;

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
    if (isOpen) fetchHistory();
  }, [isOpen, fetchHistory]);

  // Reset when patient changes
  useEffect(() => {
    setHistory([]);
    setViewerUrl(null);
  }, [patientId]);

  const disabled = !selectedAppointment;

  return (
    <>
      {/* Trigger Button (embedded in TabletFocusLayout header) */}
      <Button
        variant="outline"
        size="lg"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(true)}
        className={cn(
          "rounded-2xl gap-3 border-white bg-white/60 backdrop-blur-md shadow-premium hover:bg-white transition-all font-bold px-6 h-12",
          disabled ? "opacity-40 cursor-not-allowed" : "text-primary"
        )}
        title={disabled ? "Select a patient first" : "View patient Rx history"}
      >
        <ClipboardList className="h-5 w-5" />
        <span className="uppercase tracking-widest text-xs">Rx History</span>
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-end p-6 bg-slate-900/20 backdrop-blur-md animate-in fade-in duration-500"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md h-full bg-white/90 backdrop-blur-2xl rounded-[3rem] shadow-premium overflow-hidden flex flex-col border border-white/40 animate-in slide-in-from-right-8 duration-500"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary shadow-lg shadow-primary/20 rounded-[1.25rem]">
                  <ClipboardList className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="font-black text-xl text-slate-900 leading-tight">Rx History</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{patientName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-3 hover:bg-slate-100 rounded-2xl transition-all group"
              >
                <X className="h-6 w-6 text-slate-400 group-hover:rotate-90 group-hover:text-slate-900 transition-all" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-bold">No Previous Prescriptions</p>
                  <p className="text-sm mt-1">This is the patient's first Rx at this clinic.</p>
                </div>
              ) : (
                history.map(appt => {
                  const completedAt = toDate(appt.completedAt);
                  const isOwnRx = appt.doctorId === user?.id;
                  return (
                    <div
                      key={appt.id}
                      onClick={() => setViewerUrl(appt.prescriptionUrl || null)}
                      className={cn(
                        "group p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
                        isOwnRx
                          ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                          : "border-slate-100 bg-white hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">Dr. {appt.doctorName}</p>
                          {isOwnRx && (
                            <span className="text-xs font-black text-primary uppercase tracking-wider">Your Rx</span>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-600 transition-all" />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        <span>{completedAt ? format(completedAt, 'MMM d, yyyy — hh:mm a') : 'Unknown date'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-8 bg-slate-50/50 border-t border-slate-100">
              <Button
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="w-full h-14 rounded-2xl text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-100"
              >
                Return to Prescription
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Prescription Image Viewer */}
      {viewerUrl && (
        <div
          className="fixed inset-0 z-[300] bg-black/90 flex flex-col"
          onClick={() => setViewerUrl(null)}
        >
          <div className="flex items-center justify-between p-6">
            <button onClick={() => setViewerUrl(null)} className="text-white font-bold">✕ Close</button>
            <a
              href={viewerUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-white bg-white/20 px-4 py-2 rounded-full text-sm font-semibold"
              onClick={e => e.stopPropagation()}
            >
              <Download className="h-4 w-4" /> Download
            </a>
          </div>
          <div
            className="flex-1 overflow-auto flex items-center justify-center p-4"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={viewerUrl}
              alt="Prescription"
              className="max-w-full max-h-full rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
