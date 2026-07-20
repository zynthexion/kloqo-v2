'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Power, AlertCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { Appointment, Doctor, Clinic, Patient } from '@kloqo/shared';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { TabletFocusLayout } from '@/components/layout/TabletFocusLayout';
import { TabletQueue } from '@/components/prescription/TabletQueue';
import { PrescriptionCanvas, PrescriptionCanvasHandle } from '@/components/prescription/PrescriptionCanvas';
import { PatientHistoryOverlay } from '@/components/prescription/PatientHistoryOverlay';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PrescriptionDraftService, getClinicNow } from '@kloqo/shared-core';
import { DoctorSidebarPanel } from './DoctorSidebarPanel';
import { apiRequest } from '@/lib/api-client';
import { differenceInDays, format, isValid } from 'date-fns';

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

interface NurseTabletDashboardProps {
  data: {
    appointments: Appointment[];
    doctors: Doctor[];
    clinic: Clinic;
  };
  selectedAppointment: Appointment | null;
  setSelectedAppointment: (a: Appointment | null) => void;
  user: any;
  isQueueOpen: boolean;
  setIsQueueOpen: (open: boolean) => void;
  isSubmitting: boolean;
  handleComplete: (fullBlob: Blob, inkBlob: Blob) => void;
  handleSkip: () => void;
  handleStartConsultation: () => void;
  canvasRef: React.RefObject<PrescriptionCanvasHandle>;
}

export function NurseTabletDashboard({
  data,
  selectedAppointment,
  setSelectedAppointment,
  user,
  isQueueOpen,
  setIsQueueOpen,
  isSubmitting,
  handleComplete,
  handleSkip,
  handleStartConsultation,
  canvasRef
}: NurseTabletDashboardProps) {
  
  const currentDoctor = selectedAppointment 
    ? data.doctors.find(d => d.id === selectedAppointment.doctorId) || data.doctors[0]
    : data.doctors[0];

  const [followUpStatus, setFollowUpStatus] = useState<{
    loading: boolean;
    isFree: boolean;
    daysSinceLastVisit: number | null;
    lastVisitDate: Date | null;
  } | null>(null);

  useEffect(() => {
    if (!selectedAppointment || !user?.clinicId) {
      setFollowUpStatus(null);
      return;
    }

    let active = true;
    const checkFollowUp = async () => {
      setFollowUpStatus({ loading: true, isFree: false, daysSinceLastVisit: null, lastVisitDate: null });
      try {
        const response = await apiRequest<Appointment[]>(
          `/prescriptions/patient/${selectedAppointment.patientId}?clinicId=${user.clinicId}`
        );
        if (!active) return;

        const doctorId = selectedAppointment.doctorId;
        // Filter for completed/prescribed appointments for the SAME doctor, excluding the current appointment
        const doctorAppointments = (response || [])
          .filter(appt => appt.doctorId === doctorId && appt.id !== selectedAppointment.id && appt.status === 'Completed')
          .map(appt => ({
            ...appt,
            completedDate: toDate(appt.completedAt || appt.date)
          }))
          .filter(appt => appt.completedDate !== null)
          .sort((a, b) => b.completedDate!.getTime() - a.completedDate!.getTime());

        const lastCompletedAppt = doctorAppointments[0];

        if (lastCompletedAppt) {
          const lastVisitDate = lastCompletedAppt.completedDate!;
          const today = getClinicNow();
          const daysSinceLastVisit = differenceInDays(today, lastVisitDate);
          
          const freeDays = currentDoctor?.freeFollowUpDays ?? 0;
          const isFree = freeDays > 0 && daysSinceLastVisit <= freeDays;

          setFollowUpStatus({
            loading: false,
            isFree,
            daysSinceLastVisit,
            lastVisitDate
          });
        } else {
          setFollowUpStatus({
            loading: false,
            isFree: false,
            daysSinceLastVisit: null,
            lastVisitDate: null
          });
        }
      } catch (err) {
        console.error('Error checking follow-up status', err);
        if (active) {
          setFollowUpStatus({
            loading: false,
            isFree: false,
            daysSinceLastVisit: null,
            lastVisitDate: null
          });
        }
      }
    };

    checkFollowUp();
    return () => {
      active = false;
    };
  }, [selectedAppointment?.id, selectedAppointment?.patientId, selectedAppointment?.doctorId, user?.clinicId, currentDoctor?.freeFollowUpDays]);

  const currentPatient = selectedAppointment ? {
    id: selectedAppointment.patientId,
    name: selectedAppointment.patientName,
    age: selectedAppointment.age,
    sex: (selectedAppointment as any).sex || 'Other',
    weight: (selectedAppointment as any).weight,
    height: (selectedAppointment as any).height,
    communicationPhone: selectedAppointment.communicationPhone,
    phone: (selectedAppointment as any).phone || '',
  } : null;

  const handleDiscardDraft = () => {
    if (selectedAppointment && confirm('Discard this restored work?')) {
      PrescriptionDraftService.clear(selectedAppointment.id);
      window.location.reload();
    }
  };

  const headerActions = (
    <div className="flex items-center gap-4">
      {user?.clinicId && (
        <div className="hover:scale-105 transition-transform duration-300">
          <PatientHistoryOverlay
            selectedAppointment={selectedAppointment || null}
            clinicId={user.clinicId}
            onAttach={(url) => {
              canvasRef.current?.addPageFromUrl(url);
            }}
            onDuplicate={(url) => {
              canvasRef.current?.loadUrlToCurrentPage(url);
            }}
          />
        </div>
      )}
      <Button 
        variant="outline" 
        size="lg" 
        onClick={() => setIsQueueOpen(true)}
        className="rounded-[1.5rem] gap-3 border-slate-200 bg-white shadow-sm hover:bg-slate-50 hover:border-primary/30 transition-all text-slate-600 hover:text-primary font-black px-6 h-14"
      >
        <div className="relative">
          <Users className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
        </div>
        <span className="uppercase tracking-[0.2em] text-[10px] hidden lg:inline">Live Queue</span>
      </Button>
    </div>
  );

  return (
    <TabletDashboardLayout
      noPadding
      headerActions={headerActions}
      rightPanel={
        <DoctorSidebarPanel
          onSelectAppointment={setSelectedAppointment}
          selectedAppointmentId={selectedAppointment?.id}
        />
      }
    >
      <TabletFocusLayout 
        queue={
          <TabletQueue 
            selectedId={selectedAppointment?.id} 
            onSelect={setSelectedAppointment} 
          />
        }
        selectedAppointment={selectedAppointment}
        clinicId={user?.clinicId}
        isQueueOpen={isQueueOpen}
        setIsQueueOpen={setIsQueueOpen}
      >
        {selectedAppointment && currentDoctor && currentPatient ? (
          currentDoctor.consultationStatus === 'In' ? (
            selectedAppointment.status === 'InConsultation' ? (
              <PrescriptionCanvas
                key={selectedAppointment.id} 
                ref={canvasRef}
                doctor={currentDoctor}
                clinic={data.clinic}
                appointment={selectedAppointment}
                patient={currentPatient as any}
                onComplete={handleComplete}
                onSkip={handleSkip}
                isSubmitting={isSubmitting}
                onDiscardDraft={handleDiscardDraft}
              />
            ) : (
              /* Verification Gatekeeper Card */
              <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6 overflow-y-auto">
                <div className="w-full max-w-2xl bg-white rounded-[3rem] shadow-premium p-12 space-y-10 border border-slate-100 relative overflow-hidden group">
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-700" />
                  
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-black uppercase tracking-widest animate-pulse mb-2">
                      <Users className="h-3 w-3" />
                      Next Patient Waiting
                    </div>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">
                      {currentPatient.name}
                    </h2>
                    <div className="flex items-center justify-center gap-4 text-slate-400 font-bold uppercase tracking-widest text-xs">
                      <span>{currentPatient.age} Years</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                      <span>{currentPatient.sex}</span>
                      {selectedAppointment.tokenNumber && (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                          <span className="text-primary">Token #{selectedAppointment.tokenNumber}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Booked Via</p>
                      <p className="text-lg font-black text-slate-800">{selectedAppointment.bookedVia}</p>
                    </div>
                    <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Appt. Time</p>
                      <p className="text-lg font-black text-slate-800">{selectedAppointment.time || 'Walk-in'}</p>
                    </div>
                  </div>

                  {/* Follow-up / Payment Status Verification */}
                  {followUpStatus && !followUpStatus.loading && (
                    <div className={cn(
                      "p-6 rounded-[2rem] border flex items-start gap-4 transition-all duration-300",
                      followUpStatus.isFree 
                        ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                        : "bg-rose-50 border-rose-100 text-rose-800"
                    )}>
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        followUpStatus.isFree ? "bg-white text-emerald-500" : "bg-white text-rose-500"
                      )}>
                        {followUpStatus.isFree ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-xs font-black uppercase tracking-wider leading-none">
                          {followUpStatus.isFree ? "Free Follow-up Consultation" : "Consultation Fee Required"}
                        </h4>
                        <p className="text-[11px] font-bold mt-2 opacity-90 leading-relaxed">
                          {followUpStatus.isFree ? (
                            `Payment is free this time. The patient's last completed visit was ${followUpStatus.daysSinceLastVisit} days ago (on ${format(followUpStatus.lastVisitDate!, 'MMMM d, yyyy')}), which is within the ${currentDoctor?.freeFollowUpDays || 0}-day free follow-up period.`
                          ) : (
                            followUpStatus.lastVisitDate ? (
                              `The patient needs to pay the consultation fee. The last completed visit was ${followUpStatus.daysSinceLastVisit} days ago (on ${format(followUpStatus.lastVisitDate, 'MMMM d, yyyy')}), which is outside the ${currentDoctor?.freeFollowUpDays || 0}-day free follow-up period.`
                            ) : (
                              `The patient needs to pay the consultation fee. No previous completed consultation was found for this doctor.`
                            )
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {followUpStatus?.loading && (
                    <div className="p-6 rounded-[2rem] border border-slate-100 bg-slate-50/50 flex items-center justify-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Checking follow-up status…</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    <Button 
                      size="lg" 
                      onClick={handleStartConsultation}
                      disabled={isSubmitting}
                      className="h-20 rounded-[2rem] text-xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95 group/btn overflow-hidden relative"
                    >
                      <span className="relative z-10 flex items-center gap-3">
                        {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6 group-hover/btn:rotate-12 transition-transform" />}
                        Yes, Start Consultation
                      </span>
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="lg" 
                      onClick={() => setIsQueueOpen(true)}
                      className="h-14 rounded-[1.5rem] text-slate-400 font-bold hover:text-primary transition-colors"
                    >
                      No, choose someone else from queue
                    </Button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-white/40 backdrop-blur-md p-12 text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-24 h-24 rounded-[2.5rem] bg-amber-50 flex items-center justify-center shadow-xl shadow-amber-500/10 border border-amber-100/50">
                <Power className="h-10 w-10 text-amber-500" />
              </div>
              <div className="max-w-md space-y-4">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Session Not Started</h2>
                <p className="text-slate-500 font-medium leading-relaxed">
                  You are currently marked as <span className="font-bold text-slate-900">"Out"</span>. 
                  Please toggle your session status to <span className="font-bold text-emerald-600">"In"</span> 
                  using the sidebar switch to start consultations and write prescriptions.
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-400 p-8 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg">
              <Sparkles className="h-10 w-10 text-primary opacity-20" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Queue is Clear</h2>
              <p className="max-w-xs mx-auto mt-2">When patients arrive, they will appear in the queue for you to start writing prescriptions.</p>
            </div>
          </div>
        )}
      </TabletFocusLayout>
    </TabletDashboardLayout>
  );
}
