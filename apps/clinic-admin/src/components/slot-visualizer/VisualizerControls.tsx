"use client";

import { format, isSameDay, startOfDay } from "date-fns";
import { Calendar as CalendarIcon, Clock, Users, UserCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, parseTime } from "@/lib/utils";
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
  bucketCount: number;
  nextWalkInPreview: any;
  nextAdvancePreview: any;
  walkInSpacing: number | null;
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
  bucketCount,
  nextWalkInPreview,
  nextAdvancePreview,
  walkInSpacing,
}: VisualizerControlsProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Doctor</label>
          <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId} disabled={doctors.length === 0}>
            <SelectTrigger>
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
          <label className="text-sm font-medium">Select Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
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
                disabled={date => isSameDay(date, startOfDay(new Date())) ? false : date < startOfDay(new Date())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Select Session</label>
          <Select
            value={selectedSessionIndex.toString()}
            onValueChange={value => setSelectedSessionIndex(Number.parseInt(value, 10))}
            disabled={availableSessions.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a session" />
            </SelectTrigger>
            <SelectContent>
              {availableSessions.length === 0 ? (
                <SelectItem value="0" disabled>
                  No sessions
                </SelectItem>
              ) : (
                availableSessions.map(session => (
                  <SelectItem key={session.index} value={session.index.toString()}>
                    {session.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {availableSessions.length > 0 && (
        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              Day Timeline & Sessions
            </h3>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span>Active Session</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted" />
                <span>Gap / Not Working</span>
              </div>
            </div>
          </div>

          <div className="relative pt-6 pb-2">
            <div className="relative h-10 w-full rounded-lg bg-muted/30 overflow-hidden ring-1 ring-inset ring-muted-foreground/10">
              <div className="absolute inset-0 flex justify-between px-2 text-[9px] text-muted-foreground/40 pointer-events-none">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="h-full w-[1px] bg-muted-foreground/10" />
                    <span className="mt-1">{i + 8}:00</span>
                  </div>
                ))}
              </div>

              {availableSessions.map((session, i) => {
                const fromTime = parseTime(session.from, selectedDate);
                const toTime = parseTime(session.to, selectedDate);
                const dayStart = startOfDay(selectedDate).getTime() + (8 * 60 * 60 * 1000);
                const dayEnd = startOfDay(selectedDate).getTime() + (22 * 60 * 60 * 1000);
                const totalMs = dayEnd - dayStart;

                const left = ((fromTime.getTime() - dayStart) / totalMs) * 100;
                const width = ((toTime.getTime() - fromTime.getTime()) / totalMs) * 100;

                return (
                  <div
                    key={i}
                    className={cn(
                      "absolute top-0 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all hover:brightness-110",
                      selectedSessionIndex === i ? "bg-primary shadow-[inset_0_0_12px_rgba(0,0,0,0.15)] ring-2 ring-primary ring-offset-1 z-10" : "bg-primary/40 text-primary-foreground/60"
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onClick={() => setSelectedSessionIndex(i)}
                    role="button"
                  >
                    S{i + 1}
                  </div>
                );
              })}

              {isSameDay(selectedDate, new Date()) && (
                <div
                  className="absolute top-0 h-full w-[2px] bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)] z-20 pointer-events-none"
                  style={{
                    left: (() => {
                      const now = new Date();
                      const dayStart = startOfDay(selectedDate).getTime() + (8 * 60 * 60 * 1000);
                      const dayEnd = startOfDay(selectedDate).getTime() + (22 * 60 * 60 * 1000);
                      const pos = ((now.getTime() - dayStart) / (dayEnd - dayStart)) * 100;
                      return `${Math.min(Math.max(pos, 0), 100)}%`;
                    })()
                  }}
                >
                  <div className="absolute -left-[5px] -top-1 h-3 w-3 rounded-full bg-destructive border-2 border-background shadow-sm" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {availableSessions.length > 0 && (
        <div className="overflow-hidden rounded-md border">
          <div className="grid gap-3 border-b bg-muted/30 p-4 text-sm md:grid-cols-5">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Upcoming slots</p>
              <p className="text-xl font-semibold">{sessionSummary.total}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Advance bookings</p>
              <p className="text-xl font-semibold">{sessionSummary.advanced}</p>
              <span className="text-xs text-muted-foreground">
                {capacityInfo.maxAdvance > 0
                  ? `${sessionSummary.advanced} / ${capacityInfo.maxAdvance} capacity`
                  : "Advance quota unavailable"}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Walk-in bookings</p>
              <p className="text-xl font-semibold">{sessionSummary.walkIn}</p>
              <span className="text-xs text-muted-foreground">
                Minimum reserve: {capacityInfo.reservedMinimum} slot{capacityInfo.reservedMinimum === 1 ? "" : "s"}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Available</p>
              <p className="text-xl font-semibold">{sessionSummary.available}</p>
              <div className="flex items-center gap-1.5 mt-1">
                {sessionSummary.available > 0 ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[9px] h-4 px-1">Walk-in OK</Badge>
                ) : (
                  <Badge variant="destructive" className="text-[9px] h-4 px-1">Full</Badge>
                )}
                <span className="text-xs text-muted-foreground">{sessionSummary.booked} booked</span>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Bucket Count</p>
              <p className="text-xl font-semibold">{bucketCount}</p>
              <span className="text-xs text-muted-foreground">
                Cancelled & No-show slots
              </span>
            </div>
          </div>
          <div className="grid gap-4 border-b bg-muted/20 px-4 py-3 text-xs text-muted-foreground md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                  Advanced (max 85%)
                </span>
                <div className="flex items-center gap-2">
                  {capacityInfo.limitReached ? (
                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5 font-black">LIMIT REACHED</Badge>
                  ) : capacityInfo.maxAdvance > 0 ? (
                    <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 border-sky-200 text-[10px] h-5 px-1.5">OPEN</Badge>
                  ) : null}
                  <span>
                    {sessionSummary.advanced}
                    {capacityInfo.maxAdvance > 0 ? ` / ${capacityInfo.maxAdvance}` : ""}
                    {capacityInfo.total > 0 ? ` · ${Math.round(capacityInfo.advancePercent)}%` : ""}
                  </span>
                </div>
              </div>
              <Progress value={Math.min(capacityInfo.advancePercent, 100)} className="h-2" />
              {capacityInfo.maxAdvance === 0 ? (
                <p className="text-[11px] text-muted-foreground">No advance capacity configured for this session.</p>
              ) : capacityInfo.limitReached ? (
                <p className="text-[11px] text-destructive">Advance booking limit reached. Convert new tokens to walk-ins.</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">{capacityInfo.remainingAdvance} advance slot(s) remaining before reaching the limit.</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Walk-ins (Minimum 15% Reserve)
                </span>
                <div className="flex items-center gap-2">
                  {sessionSummary.available > 0 ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px] h-5 px-1.5">OPEN FOR BOOKING</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5 font-black uppercase">CAPACITY REACHED</Badge>
                  )}
                  <span>
                    {sessionSummary.walkIn} booked
                    {capacityInfo.total > 0 ? ` · ${Math.round(capacityInfo.walkInPercent)}%` : ""}
                  </span>
                </div>
              </div>
              <Progress value={Math.min(capacityInfo.walkInPercent, 100)} className="h-2" />
              <p className="text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Reserve: {capacityInfo.reservedMinimum} slots (last 15% of session)</span>
                {sessionSummary.available > 0 ? (
                  <span className="text-emerald-600 font-bold">{sessionSummary.available} slots remaining</span>
                ) : (
                  <span className="text-destructive font-black uppercase tracking-tighter">No slots left</span>
                )}
              </p>
            </div>
          </div>

          {nextWalkInPreview ? (
            <div className="border-b bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-600/80">Next Walk-in Target</p>
                <p className="font-semibold">
                  Slot #{nextWalkInPreview.slotIndex + 1} · {format(nextWalkInPreview.time, "hh:mm a")}
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-200/50 text-[10px] font-bold uppercase ring-1 ring-emerald-300">
                    {walkInSpacing && walkInSpacing > 0 ? `Spacing Applied (v=${walkInSpacing})` : 'Next Available'}
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <div className="border-b bg-muted/15 px-4 py-3 text-sm text-muted-foreground flex items-center gap-3">
              <AlertCircle className="h-5 w-5 opacity-50" />
              <span>Unable to determine the next walk-in slot based on the current data.</span>
            </div>
          )}

          {nextAdvancePreview ? (
            <div className="border-b bg-sky-50/60 px-4 py-3 text-sm text-sky-900 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-sky-600/80">Next Advance Target</p>
                <p className="font-semibold">
                  Slot #{nextAdvancePreview.slotIndex + 1} · {format(nextAdvancePreview.time, "hh:mm a")}
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-sky-200/50 text-[10px] font-bold uppercase ring-1 ring-sky-300">
                    Primary Availability
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <div className="border-b bg-muted/15 px-4 py-3 text-sm text-muted-foreground flex items-center gap-3">
              <AlertCircle className="h-5 w-5 opacity-50" />
              <span>Unable to determine the next advance slot based on the current data.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
