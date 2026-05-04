import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMemo } from "react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { usePrescriptionViewer } from "@/hooks/usePrescriptionViewer";
import { PrescriptionViewerModal } from "../prescriptions/PrescriptionViewerModal";
import type { useAppointmentsPage } from "@/hooks/use-appointments-page";
import { AppointmentTable } from "./AppointmentTable";
import { AppointmentQueueView } from "./AppointmentQueueView";
import { compareAppointments } from "@kloqo/shared";

interface AppointmentListProps {
  state: ReturnType<typeof useAppointmentsPage>['state'];
  actions: ReturnType<typeof useAppointmentsPage>['actions'];
}

export function AppointmentList({ state, actions }: AppointmentListProps) {
  const {
    appointments,
    loading,
    drawerSearchTerm,
    activeTab,
    drawerDateRange,
    filteredAppointments,
    layoutMode
  } = state;
  const { isOpen, prescriptionUrl, openViewer, closeViewer } = usePrescriptionViewer();

  const {
    setEditingAppointment,
    setDrawerSearchTerm,
    setActiveTab,
    setDrawerDateRange,
    setLayoutMode,
    getDisplayTimeForAppointment,
    handleComplete,
    handleStart,
    handleAddToQueue
  } = actions;

  const todaysAppointments = useMemo(() => {
    const today = format(new Date(), "d MMMM yyyy");
    return appointments
      .filter(apt => apt.date === today)
      .sort(compareAppointments);
  }, [appointments]);

  const sortedFilteredAppointments = useMemo(() => {
    return [...filteredAppointments].sort(compareAppointments);
  }, [filteredAppointments]);

  const arrivedCount = todaysAppointments.filter(apt => ['Confirmed', 'InConsultation'].includes(apt.status)).length;
  const pendingCount = todaysAppointments.filter(apt => apt.status === 'Pending').length;
  const skippedCount = todaysAppointments.filter(apt => ['Skipped', 'No-show'].includes(apt.status)).length;

  const isAuditMode = layoutMode !== 'registration';

  return (
    <Card className="h-full rounded-2xl flex flex-col overflow-hidden border-none shadow-none bg-transparent">
      <CardHeader className={cn("border-b px-0 pb-4 shrink-0", isAuditMode ? "space-y-4" : "space-y-2")}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-black text-slate-900 uppercase tracking-tight">
            {isAuditMode ? "Appointment Audit" : "Today's Queue"}
          </CardTitle>
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-100 font-black px-3 py-1 rounded-full text-[10px] uppercase">
              {todaysAppointments.length} Total
            </Badge>
          </div>
        </div>

        {isAuditMode ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                <TabsList className="bg-slate-100/50 p-1 rounded-xl">
                  <TabsTrigger value="all" className="rounded-lg px-4 text-xs font-bold">All</TabsTrigger>
                  <TabsTrigger value="arrived" className="rounded-lg px-4 text-xs font-bold">Arrived</TabsTrigger>
                  <TabsTrigger value="pending" className="rounded-lg px-4 text-xs font-bold">Pending</TabsTrigger>
                  <TabsTrigger value="completed" className="rounded-lg px-4 text-xs font-bold">Completed</TabsTrigger>
                </TabsList>
              </Tabs>
              <DateRangePicker
                initialDateRange={drawerDateRange}
                onDateChange={setDrawerDateRange}
                className="bg-white border-slate-200"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search..."
                className="pl-10 h-11 bg-white border-slate-200 rounded-xl text-sm"
                value={drawerSearchTerm}
                onChange={(e) => setDrawerSearchTerm(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-100/50 p-1 rounded-xl">
                <TabsTrigger value="arrived" className="rounded-lg font-bold">Arrived ({arrivedCount})</TabsTrigger>
                <TabsTrigger value="pending" className="rounded-lg font-bold">Pending ({pendingCount})</TabsTrigger>
                <TabsTrigger value="skipped" className="rounded-lg font-bold text-amber-600">Skipped ({skippedCount})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filter queue..."
                className="pl-9 h-9 bg-white border-slate-200 rounded-full text-xs"
                value={drawerSearchTerm}
                onChange={(e) => setDrawerSearchTerm(e.target.value)}
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-2 custom-scrollbar">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border bg-muted/50 animate-pulse h-20"></div>
              ))}
            </div>
          ) : isAuditMode ? (
            <AppointmentTable 
              appointments={sortedFilteredAppointments}
              getDisplayTimeForAppointment={getDisplayTimeForAppointment}
              openViewer={openViewer}
              setEditingAppointment={setEditingAppointment}
              setLayoutMode={setLayoutMode}
            />
          ) : (
            <AppointmentQueueView 
              activeTab={activeTab}
              appointments={todaysAppointments}
              openViewer={openViewer}
              handleComplete={handleComplete}
              handleStart={handleStart}
              handleAddToQueue={handleAddToQueue}
            />
          )}
        </ScrollArea>
      </CardContent>

      <PrescriptionViewerModal 
        isOpen={isOpen}
        prescriptionUrl={prescriptionUrl}
        onClose={closeViewer}
      />
    </Card>
  );
}
