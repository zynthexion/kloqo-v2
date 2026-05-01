"use client";

import { Coffee, Plus, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

interface BreakScheduleProps {
  breaks: any[];
  selectedDoctor: string;
}

export function BreakSchedule({ breaks, selectedDoctor }: BreakScheduleProps) {
  const router = useRouter();

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coffee className="h-5 w-5 text-amber-600" />
          <h3 className="font-black text-slate-800 uppercase tracking-tight">Break Schedule</h3>
        </div>
        {selectedDoctor && (
          <button
            onClick={() => router.push(`/schedule-break?doctor=${selectedDoctor}`)}
            className="h-8 w-8 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      {breaks.length > 0 ? (
        breaks.map((brk: any, i: number) => (
          <div key={i} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="font-bold text-amber-800">
                {format(new Date(brk.startTime), "hh:mm a")} - {format(new Date(brk.endTime), "hh:mm a")}
              </span>
            </div>
            <Badge className="bg-amber-200 text-amber-800 hover:bg-amber-200 border-none px-3 py-1 font-bold text-[10px] uppercase">
              Scheduled
            </Badge>
          </div>
        ))
      ) : (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-sm font-bold text-slate-400 italic">No breaks scheduled for this day</p>
        </div>
      )}
    </div>
  );
}
