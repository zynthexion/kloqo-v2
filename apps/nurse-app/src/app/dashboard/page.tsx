'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { TabletFocusLayout } from '@/components/layout/TabletFocusLayout';
import { TabletQueue } from '@/components/prescription/TabletQueue';
import { PrescriptionCanvas, PrescriptionCanvasHandle } from '@/components/prescription/PrescriptionCanvas';
import { TabletDashboardLayout } from '@/components/layout/TabletDashboardLayout';
import { PatientHistoryOverlay } from '@/components/prescription/PatientHistoryOverlay';
import { Button } from '@/components/ui/button';
import LiveDashboard from '@/components/clinic/LiveDashboard';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { NurseDesktopShell } from '@/components/layout/NurseDesktopShell';
import { NurseDesktopDashboard } from '@/components/dashboard/NurseDesktopDashboard';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { Loader2, Sparkles, Users, Power, AlertCircle } from 'lucide-react';
import { Appointment, Doctor } from '@kloqo/shared';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { data, loading: dashboardLoading, completeWithPrescription } = useNurseDashboardContext();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const { activeRole } = useActiveIdentity();
  const { toast } = useToast();
  const canvasRef = React.useRef<PrescriptionCanvasHandle>(null);

  const arrivedQueue = React.useMemo(() => {
    if (!data?.appointments) return [];
    return data.appointments.filter(a => ['Confirmed', 'Skipped'].includes(a.status));
  }, [data]);

  // Hook 7: Auth Redirect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Hook 8: Auto-selection
  useEffect(() => {
    if (arrivedQueue.length > 0 && !selectedAppointment) {
      setSelectedAppointment(arrivedQueue[0]);
    } else if (arrivedQueue.length === 0) {
      setSelectedAppointment(null);
    }
  }, [arrivedQueue, selectedAppointment]);

  const handleComplete = async (fullBlob: Blob, inkBlob: Blob) => {
    if (!selectedAppointment) return;
    setIsSubmitting(true);
    try {
      await completeWithPrescription(selectedAppointment.id, selectedAppointment.patientId, fullBlob, inkBlob);
      toast({
        title: "Success",
        description: `Prescription sent for ${selectedAppointment.patientName}`,
      });
      setSelectedAppointment(null); 
    } catch (error) {
       toast({
        title: "Error",
        description: "Failed to upload prescription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (arrivedQueue.length > 1) {
       const currentIndex = arrivedQueue.findIndex(a => a.id === selectedAppointment?.id);
       const nextIndex = (currentIndex + 1) % arrivedQueue.length;
       setSelectedAppointment(arrivedQueue[nextIndex]);
    }
  };

  const tabletView = React.useMemo(() => {
    if (!data) return null;

    const currentDoctor = selectedAppointment 
      ? data.doctors.find(d => d.id === selectedAppointment.doctorId) || data.doctors[0]
      : data.doctors[0];

    const currentPatient = selectedAppointment ? {
      id: selectedAppointment.patientId,
      name: selectedAppointment.patientName,
      age: selectedAppointment.age,
      sex: (selectedAppointment as any).sex || 'Other',
      weight: (selectedAppointment as any).weight,
      height: (selectedAppointment as any).height,
    } : null;

    const headerActions = (
      <div className="flex items-center gap-4">
        {user?.clinicId && (
          <div className="hover:scale-105 transition-transform duration-300">
            <PatientHistoryOverlay
              selectedAppointment={selectedAppointment || null}
              clinicId={user.clinicId}
              onAttach={(url) => {
                canvasRef.current?.addPageFromUrl(url);
                toast({
                  title: "Prescription Attached",
                  description: "The selected prescription has been added as a new page.",
                });
              }}
              onDuplicate={(url) => {
                canvasRef.current?.loadUrlToCurrentPage(url);
                toast({
                  title: "Prescription Duplicated",
                  description: "The previous handwriting has been loaded onto the current prescription.",
                });
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
      <TabletDashboardLayout noPadding headerActions={headerActions}>
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
              />
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
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-4 max-w-sm">
                   <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <AlertCircle className="h-5 w-5 text-emerald-600" />
                   </div>
                   <p className="text-[11px] font-bold text-slate-500 text-left leading-tight">
                      Starting a session will automatically notify all waiting patients that consultations have begun.
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
  }, [data, selectedAppointment, handleComplete, handleSkip, isSubmitting, user?.clinicId]);

  if (authLoading || (user && dashboardLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-gray-50 font-pt-sans">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-slate-500 font-medium tracking-tight">Initializing Session...</p>
      </div>
    );
  }

  if (!user) return null;

  const mobileView = (
    <AppFrameLayout showBottomNav={true} className="bg-slate-50 font-pt-sans">
      <LiveDashboard clinicId={user.clinicId!} />
    </AppFrameLayout>
  );

  return (
    <ResponsiveAppLayout 
      mobile={mobileView} 
      tablet={
        activeRole === 'nurse' ? (
          <NurseDesktopShell>
            <NurseDesktopDashboard />
          </NurseDesktopShell>
        ) : tabletView
      } 
    />
  );
}
