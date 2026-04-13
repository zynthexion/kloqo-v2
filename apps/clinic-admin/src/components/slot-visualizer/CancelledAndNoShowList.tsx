"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { formatTimeDisplay } from "@/lib/slot-visualizer-utils";

interface CancelledAndNoShowListProps {
  slots: any[];
}

export function CancelledAndNoShowList({ slots }: CancelledAndNoShowListProps) {
  if (slots.length === 0) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-md border border-destructive/20">
      <div className="border-b bg-destructive/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-destructive">
          Cancelled & No-Show Slots ({slots.length})
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          These slots were cancelled or marked as no-show
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {slots.map((slot) => {
          const isCancelled = slot.appointment.status === "Cancelled";
          const cardStyles = cn(
            "relative flex flex-col gap-2 rounded-lg border p-3 text-xs shadow-sm transition md:text-sm",
            isCancelled
              ? "border-destructive bg-red-50 hover:border-destructive/80 hover:bg-red-50/80"
              : "border-orange-300 bg-orange-50 hover:border-orange-400 hover:bg-orange-50/80"
          );

          return (
            <div key={slot.slotIndex} className={cardStyles}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-xs uppercase text-muted-foreground">Slot</span>
                  <span className="text-lg font-semibold">#{slot.slotIndex + 1}</span>
                </div>
                <Badge variant="outline">{format(slot.time, "hh:mm a")}</Badge>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-destructive">
                  {isCancelled ? "Cancelled" : "No-show"}
                </span>
                {slot.appointment.tokenNumber && (
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-medium text-foreground">
                    {slot.appointment.tokenNumber}
                  </span>
                )}
              </div>

              <div className="min-h-[2.5rem] text-sm">
                <div className="flex flex-col gap-2">
                  <p className="font-medium leading-tight">
                    {slot.appointment.patientName ?? "Unknown patient"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {slot.appointment.communicationPhone ?? "—"}
                  </p>
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <p>
                      <span className="font-semibold text-foreground/80">Booked via:</span>{" "}
                      {slot.appointment.bookedVia ?? "—"}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground/80">Original time:</span>{" "}
                      {formatTimeDisplay(slot.appointment.time)}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isCancelled ? "destructive" : "secondary"}>
                    {isCancelled ? "Cancelled" : "No-show"}
                  </Badge>
                  {slot.appointment.bookedVia && (
                    <Badge variant="outline">
                      {slot.appointment.bookedVia === "Walk-in" ? "Walk-in" : "Advanced"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
