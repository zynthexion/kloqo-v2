"use client";

import { Users, Clock, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppFrameLayout from "@/components/layout/AppFrameLayout";
import ClinicHeader from "@/components/clinic/ClinicHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppointmentDatePicker } from "@/components/appointments/AppointmentDatePicker";
import { StatsGrid } from "./StatsGrid";
import { BreakSchedule } from "./BreakSchedule";
import { Doctor } from "@kloqo/shared";

interface MobileSnapshotViewProps {
  data: any;
  selectedDoctor: string;
  handleDoctorChange: (id: string) => void;
  activeRole: string;
  dates: Date[];
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  activeSession: string;
  setActiveSession: (s: string) => void;
  sessions: any[];
  dateLoading: boolean;
  stats: any;
  isPastDate: boolean;
  breaks: any[];
}

export function MobileSnapshotView({
  data,
  selectedDoctor,
  handleDoctorChange,
  activeRole,
  dates,
  selectedDate,
  setSelectedDate,
  activeSession,
  setActiveSession,
  sessions,
  dateLoading,
  stats,
  isPastDate,
  breaks
}: MobileSnapshotViewProps) {
  return (
    <AppFrameLayout showBottomNav>
      <div className="flex flex-col min-h-screen bg-slate-50 w-full max-w-md mx-auto">
        <ClinicHeader
          doctors={(data?.doctors ?? []) as Doctor[]}
          selectedDoctor={selectedDoctor}
          onDoctorChange={handleDoctorChange}
          showLogo={false}
          pageTitle="Day Snapshot"
          showSettings={false}
        />

        <main className="flex-1 p-4 -mt-6 z-10 bg-white rounded-t-3xl shadow-xl flex flex-col gap-6">
          {activeRole === "doctor" && (
            <Button 
              onClick={() => window.location.href = `/appointments/schedule?doctor=${selectedDoctor}`}
              className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md flex items-center justify-center gap-2"
            >
              <CalendarIcon className="h-5 w-5" />
              Update My Schedule
            </Button>
          )}

          <AppointmentDatePicker 
            dates={dates} 
            selectedDate={selectedDate} 
            onSelectDate={(d) => { setSelectedDate(d); setActiveSession("all"); }} 
          />

          <div className="space-y-6 pb-24">
            {sessions.length > 0 && (
              <div className="px-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Filter by Session</h3>
                <Tabs value={activeSession} onValueChange={setActiveSession}>
                  <TabsList className="bg-slate-100/50 h-auto p-1.5 w-full flex gap-1 border border-slate-100 rounded-2xl overflow-x-auto no-scrollbar">
                    <TabsTrigger value="all" className="flex-1 rounded-xl py-2 font-bold text-xs data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                      All Day
                    </TabsTrigger>
                    {sessions.map((session: any, index: number) => (
                      <TabsTrigger key={index} value={index.toString()} className="flex-1 rounded-xl py-2 font-bold text-[10px] data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                        {session.from} - {session.to}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            )}

            <StatsGrid stats={stats} loading={dateLoading} selectedDate={selectedDate} isPastDate={isPastDate} />

            {isPastDate && (
              <div className="bg-slate-50 rounded-2xl p-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Past Performance</h3>
                <div className="space-y-2">
                  {[
                    { label: "Cancelled", value: stats.cancelled, color: "bg-red-500", textColor: "text-red-600" },
                    { label: "No-show", value: stats.noshow, color: "bg-amber-500", textColor: "text-amber-600" },
                    { label: "Skipped", value: stats.skipped, color: "bg-orange-500", textColor: "text-orange-600" },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-center text-sm font-bold">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-slate-600">{item.label}</span>
                      </div>
                      <span className={item.textColor}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <BreakSchedule breaks={breaks} selectedDoctor={selectedDoctor} />
          </div>
        </main>
      </div>
    </AppFrameLayout>
  );
}
