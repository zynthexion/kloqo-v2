"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Clock, History, UserCheck, Users, CheckCircle2, ShieldAlert, MoreHorizontal } from "lucide-react";
import type { Appointment } from '@kloqo/shared';
import type { SessionSlot, SessionOption } from "@/lib/slot-visualizer-utils";
import { formatTimeDisplay } from "@/lib/slot-visualizer-utils";

interface SlotCardProps {
  slot: {
    slotIndex: number;
    time: Date;
    appointment?: Appointment;
  };
  isBlocked: boolean;
  isPastSlot: boolean;
  isNextWalkInTarget: boolean;
  isNextAdvanceTarget: boolean;
  isOutsideAvailability: boolean;
  activeStatuses: Set<string>;
}

export function SlotCard({
  slot,
  isBlocked,
  isPastSlot,
  isNextWalkInTarget,
  isNextAdvanceTarget,
  isOutsideAvailability,
  activeStatuses
}: SlotCardProps) {
  const appointment = slot.appointment;
  const isCancelled = appointment?.status === "Cancelled";
  const isNoShow = appointment?.status === "No-show";
  const hasActiveAppointment = Boolean(appointment) && activeStatuses.has(appointment?.status ?? "");
  const isWalkIn = appointment?.bookedVia === "Walk-in" && hasActiveAppointment;

  const cardStyles = cn(
    "relative flex flex-col gap-2 rounded-lg border p-3 text-xs shadow-sm transition md:text-sm",
    isBlocked
      ? "border-gray-400 bg-gray-100 hover:border-gray-500 hover:bg-gray-100/80 opacity-75"
      : isCancelled
        ? "border-destructive bg-red-50 hover:border-destructive/80 hover:bg-red-50/80"
        : hasActiveAppointment
          ? isWalkIn
            ? "border-emerald-300 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-50/80"
            : "border-sky-300 bg-sky-50 hover:border-sky-400 hover:bg-sky-50/80"
          : "border-muted bg-background hover:border-muted-foreground/40",
    {
      "ring-2 ring-emerald-500 ring-offset-2": isNextWalkInTarget && !isBlocked,
      "ring-2 ring-sky-500 ring-offset-2": !isCancelled && !isBlocked && isNextAdvanceTarget,
      "border-dashed": isOutsideAvailability && !isBlocked && !hasActiveAppointment,
      "bg-amber-50/50 border-amber-300": isOutsideAvailability && !isBlocked && !hasActiveAppointment,
      "opacity-60": isPastSlot,
    }
  );

  return (
    <div className={cardStyles}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase text-muted-foreground/60 leading-none mb-1">Slot Index</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black tracking-tight">#{slot.slotIndex + 1}</span>
            <Badge variant="secondary" className="px-1 py-0 text-[9px] font-mono h-4 bg-muted/50 text-muted-foreground">
              ID:{slot.slotIndex}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="font-mono bg-background/50 shadow-sm border-muted-foreground/10">
            {format(slot.time, "hh:mm a")}
          </Badge>
          {slot.slotIndex >= 1000 && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/10 px-1 rounded ring-1 ring-primary/20">
              S{Math.floor(slot.slotIndex / 1000) + 1} Namespace
            </div>
          )}
        </div>
      </div>
      {isPastSlot && (
        <div className="flex items-center gap-2 rounded-full bg-muted/50 px-2 py-1 text-[11px] font-medium text-muted-foreground">
          Past Slot
        </div>
      )}
      {isOutsideAvailability && !isBlocked && (
        <div className="flex items-center gap-2 rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700">
          Outside Availability Time
        </div>
      )}
      {isBlocked && (
        <div className="flex items-center gap-2 rounded-full bg-gray-500/10 px-2 py-1 text-[11px] font-medium text-gray-700">
          Blocked (Cancelled & No-Show Bucket)
        </div>
      )}
      {isNextWalkInTarget && !isBlocked && (
        <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700">
          Next walk-in target
        </div>
      )}
      {isNextAdvanceTarget && !isCancelled && !isBlocked && (
        <div className="flex items-center gap-2 rounded-full bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-700">
          Next advance target
        </div>
      )}
      {isCancelled && isNextAdvanceTarget && !isBlocked && (
        <div className="flex items-center gap-2 rounded-full bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
          Cancelled – reserved for next advance booking
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            "font-medium",
            isBlocked
              ? "text-gray-600"
              : hasActiveAppointment
                ? "text-foreground"
                : isCancelled
                  ? "text-destructive"
                  : "text-muted-foreground",
          )}
        >
          {isBlocked
            ? "Blocked"
            : isCancelled
              ? "Cancelled"
              : hasActiveAppointment
                ? "Booked"
                : "Available"}
        </span>
        {appointment?.tokenNumber && (
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-medium text-foreground">
            {appointment.tokenNumber}
          </span>
        )}
      </div>

      <div className="min-h-[2.5rem] text-sm">
        {appointment ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                {appointment.patientName ? appointment.patientName.charAt(0) : '?'}
              </div>
              <p className="font-bold leading-tight">
                {appointment.patientName ?? "Unknown patient"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <History className="h-3 w-3" />
              <span>{appointment.communicationPhone ?? "—"}</span>
            </div>
            <div className="space-y-1 rounded-md bg-background/40 p-1.5 text-[10px] text-muted-foreground ring-1 ring-inset ring-muted-foreground/5">
              <div className="flex justify-between border-b border-muted-foreground/5 pb-1 mb-1">
                <span className="font-semibold text-foreground/80 lowercase italic">Time Plan</span>
                <span className="font-mono">{formatTimeDisplay(appointment.time)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div className="flex items-center gap-1">
                  <div className="h-1 w-1 rounded-full bg-sky-400" />
                  <span>Cut-off:</span>
                  <span className="ml-auto font-mono">{formatTimeDisplay(appointment.cutOffTime)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-1 w-1 rounded-full bg-destructive" />
                  <span>No-show:</span>
                  <span className="ml-auto font-mono">{formatTimeDisplay(appointment.noShowTime)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 py-2 opacity-30 select-none">
            <MoreHorizontal className="h-5 w-5" />
            <p className="text-[10px] uppercase font-bold tracking-widest">Available</p>
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          {appointment?.status && (
            <Badge
              variant={
                appointment.status === "Pending" ? "secondary" :
                  appointment.status === "Confirmed" ? "default" :
                    appointment.status === "Completed" ? "default" :
                      appointment.status === "Skipped" ? "outline" :
                        appointment.status === "No-show" ? "destructive" :
                          appointment.status === "Cancelled" ? "destructive" :
                            "outline"
              }
              className={cn(
                "flex items-center gap-1 px-1.5 py-0 text-[10px] font-bold h-5",
                appointment.status === "Completed" ? "bg-emerald-500 text-white border-none shadow-sm" :
                  appointment.status === "Skipped" ? "border-orange-400 text-orange-700 bg-orange-50" :
                    ""
              )}
            >
              {appointment.status === "Completed" && <CheckCircle2 className="h-3 w-3" />}
              {appointment.status === "Pending" && <Clock className="h-3 w-3" />}
              {appointment.status === "No-show" && <ShieldAlert className="h-3 w-3" />}
              {appointment.status}
            </Badge>
          )}

          {appointment && (
            <div className={cn(
              "flex items-center justify-center rounded-md p-1",
              isWalkIn ? "bg-emerald-100/50 text-emerald-600 ring-1 ring-inset ring-emerald-600/20" : "bg-sky-100/50 text-sky-600 ring-1 ring-inset ring-sky-600/20"
            )}>
              {isWalkIn ? <Users className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
