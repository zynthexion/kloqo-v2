'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { ResponsiveAppLayout } from '@/components/layout/ResponsiveAppLayout';
import { PrescriptionCanvasHandle } from '@/components/prescription/PrescriptionCanvas';
import LiveDashboard from '@/components/clinic/LiveDashboard';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { NurseDesktopShell } from '@/components/layout/NurseDesktopShell';
import { NurseDesktopDashboard } from '@/components/dashboard/NurseDesktopDashboard';
import { NurseTabletDashboard } from '@/components/dashboard/NurseTabletDashboard';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';
import { Loader2 } from 'lucide-react';
import { Appointment, compareAppointments, compareAppointmentsClassic } from '@kloqo/shared';
import { PrescriptionDraftService } from '@kloqo/shared-core';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { data, loading: dashboardLoading, completeWithPrescription, updateAppointmentStatus } = useNurseDashboardContext();
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const { activeRole } = useActiveIdentity();
  const { toast } = useToast();
  const canvasRef = React.useRef<PrescriptionCanvasHandle>(null);

  const arrivedQueue = React.useMemo(() => {
    if (!data?.appointments) return [];
    const filtered = data.appointments.filter(a => ['Confirmed', 'InConsultation'].includes(a.status));
    return [...filtered].sort((a, b) => {
      const doctor = data.doctors?.[0];
      const distribution = doctor?.tokenDistribution || 'advanced';
      return distribution === 'advanced' ? compareAppointments(a, b) : compareAppointmentsClassic(a, b);
    });
  }, [data]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (arrivedQueue.length > 0) {
      if (!selectedAppointment) {
        setSelectedAppointment(arrivedQueue[0]);
      } else {
        const currentVersion = arrivedQueue.find(a => a.id === selectedAppointment.id);
        if (currentVersion && currentVersion.status !== selectedAppointment.status) {
          setSelectedAppointment(currentVersion);
        }
      }
    } else if (arrivedQueue.length === 0) {
      setSelectedAppointment(null);
    }
  }, [arrivedQueue, selectedAppointment]);

  const handleStartConsultation = async () => {
    if (!selectedAppointment) return;
    setIsSubmitting(true);
    try {
      setSelectedAppointment({ ...selectedAppointment, status: 'InConsultation' });
      await updateAppointmentStatus(selectedAppointment.id, 'InConsultation');
      toast({ title: "Consultation Started", description: `${selectedAppointment.patientName} is now in consultation.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to start consultation.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async (fullBlob: Blob, inkBlob: Blob) => {
    if (!selectedAppointment) return;
    setIsSubmitting(true);
    try {
      await completeWithPrescription(selectedAppointment.id, selectedAppointment.patientId, fullBlob, inkBlob);
      PrescriptionDraftService.clear(selectedAppointment.id);
      toast({ title: "Success", description: `Prescription sent for ${selectedAppointment.patientName}` });
      setSelectedAppointment(null); 
    } catch (error) {
       toast({ title: "Error", description: "Failed to upload prescription.", variant: "destructive" });
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

  if (authLoading || (user && dashboardLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-gray-50">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-slate-500 font-medium">Initializing Session...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <ResponsiveAppLayout 
      mobile={
        <AppFrameLayout showBottomNav={true} className="bg-slate-50 font-pt-sans">
          <LiveDashboard clinicId={user.clinicId!} />
        </AppFrameLayout>
      } 
      tablet={
        activeRole === 'nurse' ? (
          <NurseDesktopShell>
            <NurseDesktopDashboard />
          </NurseDesktopShell>
        ) : (
          data && (
            <NurseTabletDashboard 
              data={data}
              selectedAppointment={selectedAppointment}
              setSelectedAppointment={setSelectedAppointment}
              user={user}
              isQueueOpen={isQueueOpen}
              setIsQueueOpen={setIsQueueOpen}
              isSubmitting={isSubmitting}
              handleComplete={handleComplete}
              handleSkip={handleSkip}
              handleStartConsultation={handleStartConsultation}
              canvasRef={canvasRef}
            />
          )
        )
      } 
    />
  );
}
