"use client";

import { useAppointmentsPage } from "@/hooks/use-appointments-page";
import { BookingCard } from "@/components/appointments/BookingCard";
import { AppointmentList } from "@/components/appointments/AppointmentList";
import { AppointmentDialogs } from "@/components/appointments/AppointmentDialogs";
import { ChevronLeft, ChevronRight, Calendar, Layout, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AddRelativeDialog } from "@/components/patients/add-relative-dialog";

export default function AppointmentsPage() {
  const { state, actions, form, patientInputRef } = useAppointmentsPage();
  const { layoutMode, primaryPatient, isAddRelativeDialogOpen } = state;
  const { setLayoutMode, setIsAddRelativeDialogOpen, handleNewRelativeAdded } = actions;

  // Rule: High-priority operational focus. Side-by-side view for booking (8/12) and today's queue (4/12).
  const isRegistration = layoutMode === 'registration';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden">
      {/* Top Navigation / Layout Switcher */}
      <header className="flex h-16 items-center justify-between border-b bg-white dark:bg-slate-900 px-6 shrink-0 shadow-sm z-30 transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-none">Walk-in Center</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time Clinic Operations</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner border border-slate-200/50 dark:border-slate-700">
          <Button 
            variant={layoutMode === 'registration' ? "default" : "ghost"}
            size="sm"
            className={cn(
              "rounded-lg text-[10px] font-black uppercase px-4 h-9 transition-all duration-300",
              layoutMode === 'registration' ? "bg-slate-900 text-white shadow-md active:scale-95" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            )}
            onClick={() => setLayoutMode('registration')}
          >
            Registration
          </Button>
          <Button 
            variant={layoutMode === 'monitoring' ? "default" : "ghost"}
            size="sm"
            className={cn(
              "rounded-lg text-[10px] font-black uppercase px-4 h-9 transition-all duration-300",
              layoutMode === 'monitoring' ? "bg-slate-900 text-white shadow-md active:scale-95" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            )}
            onClick={() => setLayoutMode('monitoring')}
          >
            Monitoring
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-400 hover:text-slate-900">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 grid grid-cols-12 overflow-hidden relative">
        {/* Left Section: Booking Form (Optimized Workspace) */}
        <div className={cn(
          "h-full border-r bg-white dark:bg-slate-900/50 shadow-sm z-10 transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) overflow-hidden",
          isRegistration ? "col-span-8 opacity-100 visible" : 
          layoutMode === 'monitoring' ? "col-span-4 opacity-100 visible" : 
          "col-span-0 opacity-0 invisible"
        )}>
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className={cn(
              "transition-all duration-700 p-8",
              isRegistration ? "max-w-4xl mx-auto" : "max-w-full"
            )}>
              <BookingCard 
                form={form} 
                state={state} 
                actions={actions} 
                patientInputRef={patientInputRef} 
              />
            </div>
          </div>
        </div>

        {/* Right Section: Appointment List */}
        <div className={cn(
          "h-full overflow-hidden transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) bg-slate-50/30 dark:bg-slate-950/20 shadow-inner",
          isRegistration ? "col-span-4" : "col-span-8"
        )}>
          <div className="h-full p-4">
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Live Operations</h3>
                <Badge variant="outline" className="text-[8px] bg-white border-slate-200">Today</Badge>
            </div>
            <AppointmentList state={state} actions={actions} />
          </div>
        </div>

        {/* Smart Toggle Helper */}
        <div className="absolute left-0 bottom-6 px-4 z-50 pointer-events-none w-full flex justify-center">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 rounded-full p-1.5 pointer-events-auto">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-900"
                    onClick={() => setLayoutMode(layoutMode === 'registration' ? 'monitoring' : 'registration')}
                >
                    <Layout className="h-4 w-4" />
                </Button>
            </div>
        </div>
      </main>

      {/* Dialogs & Overlays */}
      <AppointmentDialogs state={state} actions={actions} />
      
      {primaryPatient && (
        <AddRelativeDialog
          isOpen={isAddRelativeDialogOpen}
          setIsOpen={setIsAddRelativeDialogOpen}
          primaryMemberId={primaryPatient.id}
          onRelativeAdded={handleNewRelativeAdded}
        />
      )}
    </div>
  );
}