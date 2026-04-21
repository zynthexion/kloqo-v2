"use client";

import { useSlotVisualizer } from "@/hooks/use-slot-visualizer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Beaker, Zap, Users, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { VisualizerControls } from "@/components/slot-visualizer/VisualizerControls";
import { SlotGrid } from "@/components/slot-visualizer/SlotGrid";
import { ClinicSystemInsights } from "@/components/slot-visualizer/ClinicSystemInsights";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";


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
    sessionSlots,
    sessionProgress,
    selectedDoctor,
    
    // simulation state
    isMockMode, setIsMockMode,
    strategyOverride, setStrategyOverride,
    allotmentOverride, setAllotmentOverride,
    ratioOverride, setRatioOverride,
    addMockAppointment,
    clearMockData,
  } = useSlotVisualizer();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Initializing V2 Lab...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 space-y-6 bg-accent/5 min-h-screen">
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <Beaker className="h-8 w-8 text-primary" />
                Slot Visualizer <span className="text-primary/40 font-thin italic">Lab</span>
            </h1>
            <p className="text-sm text-muted-foreground font-medium">
                {clinicName} · <span className="font-bold text-foreground">Clinic Admin Diagnostic Suite</span>
            </p>
        </div>

        <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn(
                "h-9 px-4 flex items-center gap-2 text-xs font-bold shadow-sm transition-all",
                isMockMode ? "border-amber-500 bg-amber-500/5 text-amber-600 ring-4 ring-amber-500/10" : "border-emerald-500 bg-emerald-500/5 text-emerald-600"
            )}>
                {isMockMode ? <Zap className="h-3.5 w-3.5 fill-current" /> : <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                {isMockMode ? "SIMULATION ACTIVE" : "LIVE DATA STREAM"}
            </Badge>
        </div>
      </div>

      <Card className="border-none shadow-xl shadow-primary/5 bg-background/80 backdrop-blur-xl">
        <CardContent className="p-0 space-y-0">
          <div className="p-6 border-b bg-accent/5">
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
                
                // simulation
                isMockMode={isMockMode}
                setIsMockMode={setIsMockMode}
                strategyOverride={strategyOverride}
                setStrategyOverride={setStrategyOverride}
                allotmentOverride={allotmentOverride}
                setAllotmentOverride={setAllotmentOverride}
                ratioOverride={ratioOverride}
                setRatioOverride={setRatioOverride}
                addMockAppointment={addMockAppointment}
                clearMockData={clearMockData}
            />
          </div>

          <div className="p-0">
            {!selectedDoctor && (
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">No Doctor Selected</p>
                <p className="text-xs text-muted-foreground/60">Choose a staff member to visualize their clinical rhythm.</p>
              </div>
            )}

            {selectedDoctor && availableSessions.length === 0 && (
               <div className="flex flex-col items-center justify-center py-24 text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <CalendarIcon className="h-6 w-6 text-amber-500" />
                </div>
                <p className="text-sm font-bold uppercase tracking-wider text-amber-600">No Availability</p>
                <p className="text-xs text-muted-foreground/60">This doctor has no slots configured for {format(selectedDate, "PPP")}.</p>
              </div>
            )}

            {selectedDoctor && availableSessions.length > 0 && (
              <div className="animate-in fade-in duration-500">
                <SlotGrid
                    sessionSlots={sessionSlots as any}
                />

                <div className="p-6 bg-accent/5 border-t">
                    <ClinicSystemInsights
                        sessionProgress={sessionProgress}
                        sessionSlots={sessionSlots as any}
                        capacityInfo={capacityInfo}
                        selectedDoctor={selectedDoctor}
                    />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
