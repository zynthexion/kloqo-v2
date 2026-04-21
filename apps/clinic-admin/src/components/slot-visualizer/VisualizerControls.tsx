"use client";

import { format } from "date-fns";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  UserCheck, 
  Eraser, 
  Play, 
  Plus, 
  Settings2, 
  FlaskConical,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Doctor } from "@kloqo/shared";
import type { SessionOption } from "@/lib/slot-visualizer-utils";

interface VisualizerControlsProps {
  doctors: Doctor[];
  selectedDoctorId: string;
  setSelectedDoctorId: (id: string) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  selectedSessionIndex: number;
  setSelectedSessionIndex: (index: number) => void;
  availableSessions: SessionOption[];
  sessionSummary: any;
  capacityInfo: any;
  
  // Simulation State
  isMockMode: boolean;
  setIsMockMode: (val: boolean) => void;
  strategyOverride?: 'classic' | 'advanced';
  setStrategyOverride: (val: 'classic' | 'advanced') => void;
  allotmentOverride?: number;
  setAllotmentOverride: (val: number) => void;
  ratioOverride?: number;
  setRatioOverride: (val: number) => void;
  addMockAppointment: (type: 'A' | 'W' | 'P') => void;
  clearMockData: () => void;
}

export function VisualizerControls({
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
  isMockMode,
  setIsMockMode,
  strategyOverride,
  setStrategyOverride,
  allotmentOverride,
  setAllotmentOverride,
  ratioOverride,
  setRatioOverride,
  addMockAppointment,
  clearMockData,
}: VisualizerControlsProps) {
  
  return (
    <div className="space-y-6">
      {/* --- TOP BAR: DOCTOR & DATE SELECTION --- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label>Select Doctor</Label>
          <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId} disabled={doctors.length === 0}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select a doctor" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map(doctor => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Select Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal bg-background",
                  !selectedDate && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={date => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Select Session</Label>
          <Select
            value={selectedSessionIndex.toString()}
            onValueChange={value => setSelectedSessionIndex(Number(value))}
            disabled={availableSessions.length === 0}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select a session" />
            </SelectTrigger>
            <SelectContent>
              {availableSessions.map(session => (
                <SelectItem key={session.index} value={session.index.toString()}>
                  {session.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col justify-end gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-accent/20 px-3 py-2 shadow-sm">
            <Database className={cn("h-4 w-4", !isMockMode ? "text-primary" : "text-muted-foreground")} />
            <Switch checked={isMockMode} onCheckedChange={setIsMockMode} />
            <FlaskConical className={cn("h-4 w-4", isMockMode ? "text-amber-500" : "text-muted-foreground")} />
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {isMockMode ? "Simulation Mode" : "Real Data Mode"}
            </span>
          </div>
        </div>
      </div>

      {/* --- LAB CONTROLS (Only visible in Mock Mode or as overrides) --- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* STRATEGY & CONFIG */}
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Settings2 className="h-4 w-4 text-primary" />
              Scheduling Parameters
            </h3>
            <Badge variant="outline" className="text-[10px] uppercase">V2 Logic</Badge>
          </div>

          <div className="space-y-6 pt-2">
            <div className="space-y-3">
              <Label className="text-xs uppercase text-muted-foreground">Distribution Strategy</Label>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  variant={strategyOverride === 'classic' ? 'default' : 'outline'}
                  className="flex-1 gap-2"
                  onClick={() => setStrategyOverride('classic')}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Classic (Zipper)
                </Button>
                <Button 
                   size="sm"
                  variant={strategyOverride === 'advanced' ? 'default' : 'outline'}
                  className="flex-1 gap-2"
                  onClick={() => setStrategyOverride('advanced')}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Advanced (Buffer)
                </Button>
              </div>
            </div>

            {strategyOverride === 'classic' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Walk-in Allotment (1 in N)</Label>
                  <span className="text-sm font-black text-primary">{allotmentOverride ?? 5}</span>
                </div>
                <Slider 
                  value={[allotmentOverride ?? 5]} 
                  onValueChange={([v]) => setAllotmentOverride(v)}
                  min={2} 
                  max={10} 
                  step={1} 
                />
                <p className="text-[10px] text-muted-foreground italic">
                  * System will reserve 1 slot for walk-ins every {allotmentOverride ?? 5} appointments.
                </p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Walk-in Reserve Ratio (Buffer %)</Label>
                  <span className="text-sm font-black text-primary">{Math.round((ratioOverride ?? 0.15) * 100)}%</span>
                </div>
                <Slider 
                  value={[(ratioOverride ?? 0.15) * 100]} 
                  onValueChange={([v]) => setRatioOverride(v / 100)}
                  min={5} 
                  max={50} 
                  step={1} 
                />
                <p className="text-[10px] text-muted-foreground italic">
                  * Last {Math.round((ratioOverride ?? 0.15) * 100)}% of session slots are reserved as buffers.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* MOCK ACTIONS */}
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Play className="h-4 w-4 text-amber-500" />
              Simulation Actions
            </h3>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={clearMockData}>
              <Eraser className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2 border-dashed hover:border-primary hover:bg-primary/5"
              onClick={() => addMockAppointment('A')}
            >
              <Plus className="h-4 w-4" />
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase">Add Adv Booking</p>
                <p className="text-[9px] text-muted-foreground">Standard A-Token</p>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2 border-dashed hover:border-emerald-500 hover:bg-emerald-500/5"
              onClick={() => addMockAppointment('W')}
            >
              <Users className="h-4 w-4 text-emerald-500" />
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase text-emerald-600">Add Walk-in</p>
                <p className="text-[9px] text-muted-foreground">Zipper/Buffer logic</p>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex-col gap-2 border-dashed hover:border-amber-500 hover:bg-amber-500/5"
              onClick={() => addMockAppointment('P')}
            >
              <UserCheck className="h-4 w-4 text-amber-500" />
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase text-amber-600">Add Priority</p>
                <p className="text-[9px] text-muted-foreground">Imm. Placement</p>
              </div>
            </Button>
            <Button 
              variant="secondary" 
              className="h-20 flex-col gap-2 opacity-50 cursor-not-allowed"
              disabled
            >
              <Clock className="h-4 w-4" />
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase">Vacuum Trigger</p>
                <p className="text-[9px] text-muted-foreground">Simulate Gap</p>
              </div>
            </Button>
          </div>
        </div>
      </div>

      {/* --- STATS SUMMARY --- */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Slots", value: sessionSummary.total, sub: "Total Capacity" },
          { label: "Adv Bookings", value: sessionSummary.advanced, sub: `Max: ${capacityInfo.maxAdvance}`, color: "text-blue-500" },
          { label: "Walk-ins", value: sessionSummary.walkIn, sub: `Reserve: ${capacityInfo.reservedMinimum}`, color: "text-emerald-500" },
          { label: "Available", value: sessionSummary.available, sub: "Remaining Slots", color: "text-amber-500" }
        ].map((stat, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
            <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">{stat.label}</p>
            <p className={cn("text-2xl font-black", stat.color)}>{stat.value}</p>
            <p className="text-[9px] text-muted-foreground">{stat.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
