'use client';

import { useAvailabilityState } from '@/hooks/use-availability-state';
import { DoctorSelector } from '@/components/settings/availability/DoctorSelector';
import { AvailabilityView } from '@/components/settings/availability/AvailabilityView';
import { AvailabilityForm } from '@/components/settings/availability/AvailabilityForm';
import { FullScreenLoader } from '@/components/full-screen-loader';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * AvailabilityPage Orchestrator
 * Modularized doctor schedule management featuring bulk-day slot configuration
 * and backend-first state synchronization.
 */
export default function AvailabilityPage() {
  const router = useRouter();
  const {
    doctors, selectedDoctor, clinicDetails, isLoading, isPending,
    isEditingAvailability, setIsEditingAvailability,
    selectedDays, setSelectedDays,
    sharedTimeSlots, setSharedTimeSlots,
    handleDoctorChange, handleAvailabilitySave,
    toast
  } = useAvailabilityState();

  if (isLoading) {
    return (
      <AppFrameLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppFrameLayout>
    );
  }

  return (
    <AppFrameLayout>
      <div className="flex flex-col h-full bg-slate-50 font-body">
        <FullScreenLoader isOpen={isPending} />

        <header className="flex items-center gap-4 p-4 border-b bg-white sticky top-0 z-50">
          <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
            <ArrowLeft />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Doctor Availability</h1>
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Global Schedule Sync</p>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <DoctorSelector 
              doctors={doctors} 
              selectedDoctorId={selectedDoctor?.id} 
              onSelect={handleDoctorChange} 
            />

            {selectedDoctor && (
              <>
                {isEditingAvailability ? (
                  <AvailabilityForm 
                    doctor={selectedDoctor} 
                    clinicDetails={clinicDetails} 
                    onSave={handleAvailabilitySave} 
                    onCancel={() => setIsEditingAvailability(false)} 
                    isPending={isPending} 
                    selectedDays={selectedDays} 
                    setSelectedDays={setSelectedDays} 
                    sharedTimeSlots={sharedTimeSlots} 
                    setSharedTimeSlots={setSharedTimeSlots} 
                    toast={toast} 
                  />
                ) : (
                  <AvailabilityView 
                    doctor={selectedDoctor} 
                    onEdit={() => setIsEditingAvailability(true)} 
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </AppFrameLayout>
  );
}
