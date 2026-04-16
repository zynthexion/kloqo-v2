import React from 'react';
import { ClipboardList } from 'lucide-react';
import { Appointment } from '@kloqo/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface PatientHistoryOverlayProps {
  selectedAppointment: Appointment | null;
  clinicId: string;
}

export function PatientHistoryOverlay({ selectedAppointment, clinicId }: PatientHistoryOverlayProps) {
  const router = useRouter();
  const patientId = selectedAppointment?.patientId;
  const patientName = selectedAppointment?.patientName;
  const disabled = !selectedAppointment;

  const handleNavigate = () => {
    if (disabled || !patientId) return;
    router.push(`/dashboard/history/${patientId}?name=${encodeURIComponent(patientName || '')}`);
  };

  return (
    <Button
      variant="outline"
      size="lg"
      disabled={disabled}
      onClick={handleNavigate}
      className={cn(
        "rounded-2xl gap-3 border-white bg-white/60 backdrop-blur-md shadow-premium hover:bg-white transition-all font-bold px-6 h-12",
        disabled ? "opacity-40 cursor-not-allowed" : "text-primary hover:scale-[1.02] active:scale-95"
      )}
      title={disabled ? "Select a patient first" : "View patient Rx history"}
    >
      <ClipboardList className="h-5 w-5" />
      <span className="uppercase tracking-widest text-xs">Rx History</span>
    </Button>
  );
}
