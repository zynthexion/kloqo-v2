"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { 
  Users, 
  UserCheck, 
  Clock, 
  ShieldAlert, 
  Lock,
  Stethoscope
} from "lucide-react";
import type { MockSlot } from "@/lib/V2PreviewScheduler";

interface SlotCardProps {
  slot: MockSlot;
  isPastSlot: boolean;
}

export function SlotCard({
  slot,
  isPastSlot,
}: SlotCardProps) {
  const appointment = slot.appointment;
  const isOccupied = !!appointment;
  
  // Style mapping based on V2 Slot Type
  const typeStyles = {
    A: {
      border: "border-slate-200 bg-background",
      badge: "Advanced",
      icon: <Clock className="h-3 w-3" />,
      color: "text-slate-500"
    },
    W: {
      border: "border-emerald-500/50 bg-emerald-500/5",
      badge: "Zipper Reservation",
      icon: <Users className="h-3 w-3 text-emerald-500" />,
      color: "text-emerald-600"
    },
    P: {
      border: "border-amber-500/50 bg-amber-500/5",
      badge: "Priority Slot",
      icon: <ShieldAlert className="h-3 w-3 text-amber-500" />,
      color: "text-amber-600"
    },
    B: {
      border: "border-slate-400 bg-slate-500/5",
      badge: "Reserved Buffer",
      icon: <Lock className="h-3 w-3 text-slate-400" />,
      color: "text-slate-500"
    }
  };

  const style = typeStyles[slot.type] || typeStyles.A;

  return (
    <div className={cn(
      "group relative flex flex-col gap-3 rounded-2xl border p-4 transition-all hover:shadow-lg",
      style.border,
      isOccupied && "border-primary bg-primary/[0.02] shadow-sm ring-1 ring-primary/20",
      isPastSlot && "opacity-50 grayscale-[0.5]"
    )}>
      {/* HEADER: TIME & ID */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Slot</span>
          <span className="text-xl font-black text-foreground">#{slot.slotIndex % 1000 + 1}</span>
        </div>
        <Badge variant="outline" className="h-6 font-mono text-[10px] bg-background/80 shadow-sm">
          {format(slot.time, "hh:mm a")}
        </Badge>
      </div>

      {/* BODY: STATUS & PATIENT */}
      <div className="flex-1 space-y-3">
        {isOccupied ? (
          <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
             <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Stethoscope className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col">
                    <p className="line-clamp-1 text-xs font-bold text-foreground">
                        {appointment.patientName}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground">
                        {appointment.tokenNumber}
                    </p>
                </div>
             </div>
             <Badge className={cn(
               "w-full justify-center text-[9px] font-bold uppercase",
               appointment.bookedVia === "Walk-in" ? "bg-emerald-500" : "bg-primary"
             )}>
                {appointment.bookedVia === "Walk-in" ? "Walk-in Joined" : "Confirmed Appt"}
             </Badge>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 py-4 opacity-40">
            {style.icon}
            <span className={cn("text-[9px] font-black uppercase tracking-wider", style.color)}>
              {slot.isReserved ? style.badge : "Available"}
            </span>
          </div>
        )}
      </div>

      {/* FOOTER: INDICATORS */}
      {slot.isReserved && !isOccupied && (
        <div className="absolute -right-2 -top-2 scale-90">
             <Badge className="h-5 px-1.5 bg-background text-[8px] border-primary/20 text-primary shadow-sm">
                RESERVED
             </Badge>
        </div>
      )}
    </div>
  );
}
