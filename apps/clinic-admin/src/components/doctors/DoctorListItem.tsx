'use client';

import Image from "next/image";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Doctor } from '@kloqo/shared';

interface DoctorListItemProps {
  doctor: Doctor;
  onSelect: () => void;
  isSelected: boolean;
}

export function DoctorListItem({ doctor, onSelect, isSelected }: DoctorListItemProps) {
  return (
    <Card
      className={cn(
        "p-4 flex items-center gap-4 cursor-pointer transition-all duration-300 border-2 rounded-2xl group",
        isSelected 
          ? "border-theme-blue bg-blue-50/50 shadow-xl shadow-theme-blue/5" 
          : "border-transparent hover:bg-slate-50 hover:border-slate-100"
      )}
      onClick={onSelect}
    >
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm transition-transform group-hover:scale-110">
          <Image
            src={doctor.avatar || '/default-doctor.png'}
            alt={doctor.name}
            width={48}
            height={48}
            className="object-cover h-full w-full"
          />
        </div>
        <span className={cn(
          "absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm",
          doctor.consultationStatus === "In" ? "bg-emerald-500 animate-pulse" : "bg-red-400"
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-black text-sm tracking-tight truncate",
          isSelected ? "text-theme-blue" : "text-slate-800"
        )}>
          {doctor.name}
        </p>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate mt-0.5">
          {doctor.department}
        </p>
      </div>
    </Card>
  );
}
