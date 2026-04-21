"use client";

import { useMemo } from "react";
import { isBefore } from "date-fns";
import { SlotCard } from "./SlotCard";
import type { MockSlot } from "@/lib/V2PreviewScheduler";

interface SlotGridProps {
  sessionSlots: MockSlot[];
}

export function SlotGrid({
  sessionSlots,
}: SlotGridProps) {
  const current = useMemo(() => new Date(), []);

  if (sessionSlots.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
         <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <span className="text-xl">?</span>
         </div>
        <p className="text-sm font-medium text-muted-foreground">
          No slots generated for this configuration.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Select a doctor with availability or use Mock Mode.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* --- GRID --- */}
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {sessionSlots.map((slot) => {
          const isPastSlot = isBefore(slot.time, current);

          return (
            <SlotCard
              key={slot.slotIndex}
              slot={slot}
              isPastSlot={isPastSlot}
            />
          );
        })}
      </div>

      {/* --- LEGEND --- */}
      <div className="flex flex-wrap items-center gap-6 border-t bg-accent/5 px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border bg-background" />
          <span>Standard (Adv)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border-2 border-emerald-500 bg-emerald-500/10" />
          <span>Zipper (Walk-in)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border-2 border-slate-400 bg-slate-500/10" />
          <span>Buffer (Reserved)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border-2 border-amber-500 bg-amber-500/10" />
          <span>Priority (PW)</span>
        </div>
        <div className="flex items-center gap-2 border-l pl-6">
          <span className="h-3 w-3 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
          <span>Occupied</span>
        </div>
      </div>
    </div>
  );
}
