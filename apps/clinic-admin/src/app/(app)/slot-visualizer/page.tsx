"use client";

import { useSlotVisualizer } from "@/hooks/use-slot-visualizer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { VisualizerControls } from "@/components/slot-visualizer/VisualizerControls";
import { SlotGrid } from "@/components/slot-visualizer/SlotGrid";
import { ClinicSystemInsights } from "@/components/slot-visualizer/ClinicSystemInsights";
import { CancelledAndNoShowList } from "@/components/slot-visualizer/CancelledAndNoShowList";

export default function SlotVisualizerPage() {
  const {
    loading,
    clinicName,
    doctors,
    selectedDoctorId,
    setSelectedDoctorId,
    selectedDate,
    setSelectedDate,
    selectedSessionIndex,
    setSelectedSessionIndex,
    availableSessions,
    sessionSummary,
    capacityInfo,
    bucketCount,
    nextWalkInPreview,
    nextAdvancePreview,
    walkInSpacing,
    sessionSlots,
    blockedSlots,
    fullDaySlots,
    sessionProgress,
    selectedDoctor,
    cancelledAndNoShowSlots,
  } = useSlotVisualizer();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col gap-1">
            <span>Slot Visualizer</span>
            {clinicName && <span className="text-sm font-normal text-muted-foreground">{clinicName}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <VisualizerControls
            doctors={doctors}
            selectedDoctorId={selectedDoctorId}
            setSelectedDoctorId={setSelectedDoctorId}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedSessionIndex={selectedSessionIndex}
            setSelectedSessionIndex={setSelectedSessionIndex}
            availableSessions={availableSessions}
            sessionSummary={sessionSummary}
            capacityInfo={capacityInfo}
            bucketCount={bucketCount}
            nextWalkInPreview={nextWalkInPreview}
            nextAdvancePreview={nextAdvancePreview}
            walkInSpacing={walkInSpacing}
          />

          <div className="space-y-4">
            {!selectedDoctor && (
              <p className="text-sm text-muted-foreground">Add a doctor to view slots for this clinic.</p>
            )}

            {selectedDoctor && availableSessions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No availability configured for this date. Update the doctor’s schedule to see slots.
              </p>
            )}

            {selectedDoctor && availableSessions.length > 0 && (
              <>
                <div className="overflow-hidden rounded-md border">
                  <SlotGrid
                    sessionSlots={sessionSlots}
                    blockedSlots={blockedSlots}
                    fullDaySlots={fullDaySlots}
                    nextWalkInPreview={nextWalkInPreview}
                    nextAdvancePreview={nextAdvancePreview}
                  />
                </div>

                <CancelledAndNoShowList slots={cancelledAndNoShowSlots} />

                <ClinicSystemInsights
                  sessionProgress={sessionProgress}
                  sessionSlots={sessionSlots}
                  capacityInfo={capacityInfo}
                  selectedDoctor={selectedDoctor}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
