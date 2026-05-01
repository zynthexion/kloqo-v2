"use client";

import { format } from "date-fns";
import {
  BarChart3, CheckCircle2, XCircle, Clock, Plus, TrendingUp, ArrowRight, Users, Coffee
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppointmentDatePicker } from "@/components/appointments/AppointmentDatePicker";
import { cn } from "@/lib/utils";
import { TabletDashboardLayout } from "@/components/layout/TabletDashboardLayout";

interface TabletSnapshotViewProps {
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  dates: Date[];
  sessions: any[];
  activeSession: string;
  setActiveSession: (s: string) => void;
  stats: any;
  selectedDoctor: string;
  breaks: any[];
  activeRole: string;
}

export function TabletSnapshotView({
  selectedDate,
  setSelectedDate,
  dates,
  sessions,
  activeSession,
  setActiveSession,
  stats,
  selectedDoctor,
  breaks,
  activeRole
}: TabletSnapshotViewProps) {
  return (
    <TabletDashboardLayout 
      hideSidebar={activeRole === "nurse"}
      hideRightPanel={activeRole === "nurse"}
    >
       <div className="max-w-7xl mx-auto space-y-10 py-10 px-6 font-pt-sans animate-in fade-in slide-in-from-bottom-4 duration-700">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-white" />
                   </div>
                   <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 font-black uppercase tracking-widest text-[10px] px-3 py-1">
                     Clinical Metrics Hub
                   </Badge>
                </div>
                <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-none">Day Snapshot<span className="text-blue-600">.</span></h1>
                <p className="text-slate-500 font-bold max-w-md leading-relaxed">
                  Real-time clinical throughput analytics and session-specific break management.
                </p>
              </div>
              
              <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-premium border border-slate-100">
                <div className="px-6 py-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Focus Date</p>
                  <p className="text-sm font-black text-slate-900">{format(selectedDate, "MMMM d, yyyy")}</p>
                </div>
              </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4 space-y-10">
              <AppointmentDatePicker 
                dates={dates} 
                selectedDate={selectedDate} 
                onSelectDate={(d) => { setSelectedDate(d); setActiveSession("all"); }} 
                isTablet 
              />

              {sessions.length > 0 && (
                <Card className="rounded-[3rem] border-none shadow-premium bg-slate-900 p-8 text-white">
                   <div className="flex items-center gap-3 mb-8">
                      <Clock className="h-5 w-5 text-blue-400" />
                      <h3 className="font-black text-white uppercase tracking-tight text-sm">Session Focus</h3>
                   </div>
                   <div className="space-y-3">
                      <button 
                        onClick={() => setActiveSession("all")}
                        className={cn(
                          "w-full p-5 rounded-2xl flex items-center justify-between transition-all font-bold",
                          activeSession === "all" ? "bg-white text-slate-900 shadow-lg" : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}
                      >
                        <span className="text-sm">Comprehensive View</span>
                        {activeSession === "all" && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                      {sessions.map((session: any, index: number) => (
                        <button 
                          key={index}
                          onClick={() => setActiveSession(index.toString())}
                          className={cn(
                            "w-full p-5 rounded-2xl flex items-center justify-between transition-all font-bold",
                            activeSession === index.toString() ? "bg-white text-slate-900 shadow-lg" : "bg-white/5 text-white/60 hover:bg-white/10"
                          )}
                        >
                          <span className="text-sm">{session.from} - {session.to}</span>
                          {activeSession === index.toString() && <CheckCircle2 className="h-4 w-4" />}
                        </button>
                      ))}
                   </div>
                </Card>
              )}
            </div>

            <div className="lg:col-span-8 space-y-10">
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
                  <Card className="col-span-2 lg:col-span-1 rounded-[3rem] border-none shadow-premium bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-white relative overflow-hidden group">
                     <Users className="absolute top-[-20%] right-[-10%] w-40 h-40 opacity-10 rotate-12 transition-transform group-hover:scale-110" />
                     <div className="relative z-10">
                        <p className="text-blue-100/60 text-[10px] font-black uppercase tracking-[0.2em]">Total Appointments</p>
                        <h3 className="text-7xl font-black mt-4 tracking-tighter leading-none">{stats.total}</h3>
                        <div className="mt-6 flex items-center gap-2 bg-white/10 w-fit px-3 py-1 rounded-full text-[10px] font-black">
                           <TrendingUp className="h-3 w-3" /> REGISTERED
                        </div>
                     </div>
                  </Card>

                  <Card className="rounded-[3rem] border-none shadow-premium bg-white p-8 border border-slate-100 group hover:border-amber-200 transition-all">
                     <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-sm group-hover:scale-110 transition-transform">
                           <Clock className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Active Queue</span>
                     </div>
                     <h3 className="text-5xl font-black text-slate-900">{stats.confirmed}</h3>
                     <p className="text-slate-400 font-bold text-xs mt-3 uppercase tracking-widest leading-none">Arrived at Clinic</p>
                  </Card>

                  <Card className="rounded-[3rem] border-none shadow-premium bg-white p-8 border border-slate-100 group hover:border-emerald-200 transition-all">
                     <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                           <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Fulfillment</span>
                     </div>
                     <h3 className="text-5xl font-black text-slate-900">{stats.completed}</h3>
                     <p className="text-slate-400 font-bold text-xs mt-3 uppercase tracking-widest leading-none">Consultations Done</p>
                  </Card>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <Card className="rounded-[3.5rem] border-none shadow-premium bg-white p-10 border border-slate-100">
                     <div className="flex items-center justify-between mb-10">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                              <Coffee className="h-6 w-6" />
                           </div>
                           <h3 className="text-xl font-black text-slate-900 tracking-tight">Break Schedule</h3>
                        </div>
                        {selectedDoctor && (
                           <Button 
                             onClick={() => window.location.href = `/schedule-break?doctor=${selectedDoctor}`}
                             variant="outline" 
                             className="rounded-2xl border-slate-200 font-black text-[10px] uppercase tracking-widest h-12 px-6 hover:bg-slate-50 transition-all"
                           >
                             <Plus className="h-4 w-4 mr-2" /> Add Period
                           </Button>
                        )}
                     </div>

                     <div className="space-y-5">
                        {breaks.length > 0 ? (
                           breaks.map((brk: any, i: number) => (
                              <div key={i} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 group hover:bg-amber-50/50 hover:border-amber-200 transition-all">
                                 <div className="flex items-center gap-5">
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                                       <Clock className="h-5 w-5 text-amber-500" />
                                    </div>
                                    <div className="flex flex-col">
                                       <span className="font-black text-slate-900 text-xl tracking-tight leading-none">
                                          {format(new Date(brk.startTime), "hh:mm a")}
                                       </span>
                                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Start Time</span>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <ArrowRight className="h-4 w-4 text-slate-300" />
                                    <div className="flex flex-col items-end">
                                       <span className="font-black text-slate-900 text-xl tracking-tight leading-none">
                                          {format(new Date(brk.endTime), "hh:mm a")}
                                       </span>
                                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">End Time</span>
                                    </div>
                                 </div>
                              </div>
                           ))
                        ) : (
                           <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/30">
                              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                 <Coffee className="h-8 w-8 text-slate-200" />
                              </div>
                              <p className="text-slate-400 font-bold text-sm tracking-tight">No clinical pauses scheduled today</p>
                           </div>
                        )}
                     </div>
                  </Card>

                  <Card className="rounded-[3.5rem] border-none shadow-premium bg-slate-50 p-10 border border-slate-100">
                     <div className="flex items-center gap-4 mb-10">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
                           <XCircle className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Clinical Attrition</h3>
                     </div>

                     <div className="space-y-6">
                        {[
                           { label: "Cancelled", value: stats.cancelled, color: "bg-red-500", bg: "bg-red-50/30" },
                           { label: "No-show", value: stats.noshow, color: "bg-amber-500", bg: "bg-amber-50/30" },
                           { label: "Skipped", value: stats.skipped, color: "bg-orange-500", bg: "bg-orange-50/30" },
                        ].map(item => (
                           <div key={item.label} className={cn("p-6 rounded-3xl flex items-center justify-between border border-white shadow-sm", item.bg)}>
                              <div className="flex items-center gap-4">
                                 <div className={cn("w-3 h-3 rounded-full shadow-sm", item.color)} />
                                 <span className="font-black text-slate-600 uppercase tracking-widest text-[11px]">{item.label}</span>
                              </div>
                              <span className="text-3xl font-black text-slate-900 tabular-nums">{item.value}</span>
                           </div>
                        ))}
                        
                        <div className="pt-10 mt-6 border-t border-slate-200/60">
                           <div className="flex justify-between items-end">
                              <div className="space-y-1">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Leakage</p>
                                 <p className="text-4xl font-black text-red-600 tabular-nums leading-none">
                                    {stats.cancelled + stats.noshow + stats.skipped}
                                 </p>
                              </div>
                              <div className="text-right">
                                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-tight mb-2">
                                    IMPACT<br />ANALYSIS
                                 </p>
                                 <TrendingUp className="h-6 w-6 text-red-100 ml-auto" />
                              </div>
                           </div>
                        </div>
                     </div>
                  </Card>
               </div>
            </div>
          </div>
       </div>
    </TabletDashboardLayout>
  );
}
