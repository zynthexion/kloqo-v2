"use client";

import { useMemo } from "react";
import { isBefore } from "date-fns";
import { AlertCircle } from "lucide-react";
import { SlotCard } from "./SlotCard";
import type { SessionSlot } from "@/lib/slot-visualizer-utils";

interface SlotGridProps {
  sessionSlots: SessionSlot[];
  blockedSlots: Set<number>;
  fullDaySlots: any[];
  nextWalkInPreview: { slotIndex: number; time: Date } | null;
  nextAdvancePreview: { slotIndex: number; time: Date } | null;
}

const ACTIVE_STATUSES = new Set(["Pending", "Confirmed", "Completed"]);

export function SlotGrid({
  sessionSlots,
  blockedSlots,
  fullDaySlots,
  nextWalkInPreview,
  nextAdvancePreview,
}: SlotGridProps) {
  const current = useMemo(() => new Date(), []);

  if (sessionSlots.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
        No slots found for this session.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {sessionSlots.map((slot) => {
          const isPastSlot = isBefore(slot.time, current);
          const isBlocked = blockedSlots.has(slot.slotIndex);
          const isNextWalkInTarget = nextWalkInPreview?.slotIndex === slot.slotIndex;
          const isNextAdvanceTarget = nextAdvancePreview?.slotIndex === slot.slotIndex;
          const isOutsideAvailability = !fullDaySlots.some(s => s.slotIndex === slot.slotIndex);

          return (
            <SlotCard
              key={slot.slotIndex}
              slot={slot}
              isBlocked={isBlocked}
              isPastSlot={isPastSlot}
              isNextWalkInTarget={isNextWalkInTarget}
              isNextAdvanceTarget={isNextAdvanceTarget}
              isOutsideAvailability={isOutsideAvailability}
              activeStatuses={ACTIVE_STATUSES}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-sky-400 bg-sky-100" />
          <span>Advanced booking</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-emerald-400 bg-emerald-100" />
          <span>Walk-in booking</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-gray-400 bg-gray-100 opacity-75" />
          <span>Blocked (Cancelled & No-Show Bucket)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-amber-300 bg-amber-50/50 border-dashed" />
          <span>Outside Availability Time</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded border border-muted bg-background" />
          <span>Available slot</span>
        </div>
      </div>
    </div>
  );
}
