"use client";

import { Users, Clock, CheckCircle2, XCircle, UserMinus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { isSameDay } from "date-fns";
import { getClinicNow } from "@kloqo/shared-core";

interface StatsGridProps {
  stats: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noshow: number;
    skipped: number;
  };
  loading: boolean;
  selectedDate: Date;
  isPastDate: boolean;
}

export function StatsGrid({ stats, loading, selectedDate, isPastDate }: StatsGridProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const isToday = isSameDay(selectedDate, getClinicNow());

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="border-none shadow-sm bg-blue-50/50 rounded-2xl ring-1 ring-blue-100/50">
        <CardContent className="p-4 flex flex-col items-center justify-center">
          <div className="bg-blue-100 p-2.5 rounded-2xl mb-3">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-700">{stats.total}</p>
          <p className="text-[10px] uppercase font-black text-blue-400 tracking-wider mt-1">Total Bookings</p>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm bg-amber-50/50 rounded-2xl ring-1 ring-amber-100/50">
        <CardContent className="p-4 flex flex-col items-center justify-center">
          <div className="bg-amber-100 p-2.5 rounded-2xl mb-3">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700">{stats.confirmed}</p>
          <p className="text-[10px] uppercase font-black text-amber-400 tracking-wider mt-1">Waiting in Clinic</p>
        </CardContent>
      </Card>

      {isPastDate || stats.completed > 0 ? (
        <Card className="border-none shadow-sm bg-green-50/50 rounded-2xl ring-1 ring-green-100/50">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="bg-green-100 p-2.5 rounded-2xl mb-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-black text-green-700">{stats.completed}</p>
            <p className="text-[10px] uppercase font-black text-green-400 tracking-wider mt-1">Completed</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-sm bg-slate-50/50 rounded-2xl ring-1 ring-slate-100/50">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="bg-slate-100 p-2.5 rounded-2xl mb-3">
              <UserMinus className="h-5 w-5 text-slate-600" />
            </div>
            <p className="text-2xl font-black text-slate-700">{stats.pending}</p>
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mt-1">Not Arrived</p>
          </CardContent>
        </Card>
      )}

      {(isPastDate || isToday) && (
        <Card className="border-none shadow-sm bg-red-50/50 rounded-2xl ring-1 ring-red-100/50">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div className="bg-red-100 p-2.5 rounded-2xl mb-3">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-black text-red-700">{stats.cancelled + stats.noshow + stats.skipped}</p>
            <p className="text-[10px] uppercase font-black text-red-400 tracking-wider mt-1">
              {isPastDate ? "Missed/Cancelled" : "Skipped/Missed"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
