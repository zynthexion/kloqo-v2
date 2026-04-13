import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  Clock, 
  Search, 
  Calendar,
  Stethoscope,
  MoreHorizontal,
  Edit,
  X,
  Printer,
  FileDown,
  Star,
  Eye
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { Fragment, useMemo } from "react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { usePrescriptionViewer } from "@/hooks/usePrescriptionViewer";
import { PrescriptionViewerModal } from "../prescriptions/PrescriptionViewerModal";
import type { useAppointmentsPage } from "@/hooks/use-appointments-page";
import type { Appointment } from "@kloqo/shared";

interface AppointmentListProps {
  state: ReturnType<typeof useAppointmentsPage>['state'];
  actions: ReturnType<typeof useAppointmentsPage>['actions'];
}

export function AppointmentList({ state, actions }: AppointmentListProps) {
  const {
    appointments,
    doctors,
    loading,
    drawerSearchTerm,
    activeTab,
    drawerDateRange,
    filteredAppointments,
    swipeCooldownUntil,
    layoutMode
  } = state;
  const { isOpen, prescriptionUrl, openViewer, closeViewer } = usePrescriptionViewer();

  const {
    setEditingAppointment,
    setDrawerSearchTerm,
    setSelectedDrawerDoctor,
    setActiveTab,
    setDrawerDateRange,
    setLayoutMode,
    setAppointmentToCancel,
    setAppointmentToAddToQueue,
    setAppointmentToComplete,
    setAppointmentToPrioritize,
    isAppointmentOnLeave,
    getDisplayTimeForAppointment,
    handleComplete,
    handleAddToQueue
  } = actions;

  const todaysAppointments = useMemo(() => {
    const today = format(new Date(), "d MMMM yyyy");
    return appointments.filter(apt => apt.date === today);
  }, [appointments]);

  const arrivedCount = todaysAppointments.filter(apt => apt.status === 'Confirmed').length;
  const pendingCount = todaysAppointments.filter(apt => (apt.status === 'Pending' || apt.status === 'Skipped')).length;

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
              <div className="flex items-center gap-2">
                <DateRangePicker
                  initialDateRange={drawerDateRange}
                  onDateChange={setDrawerDateRange}
                  className="bg-white border-slate-200"
                />
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by patient, phone or doctor..."
                className="pl-10 h-11 bg-white border-slate-200 rounded-xl text-sm"
                value={drawerSearchTerm}
                onChange={(e) => setDrawerSearchTerm(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-100/50 p-1 rounded-xl">
                <TabsTrigger value="arrived" className="rounded-lg font-bold">Arrived ({arrivedCount})</TabsTrigger>
                <TabsTrigger value="pending" className="rounded-lg font-bold">Pending ({pendingCount})</TabsTrigger>
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
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-black text-[10px] uppercase tracking-wider">Patient</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-wider">Info</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-wider">Doctor</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-wider">Date/Time</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-wider">Token</TableHead>
                  <TableHead className="text-right font-black text-[10px] uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  let lastSessionIndex = -1;
                  return filteredAppointments.map((appointment) => {
                    const currentSessionIndex = appointment.sessionIndex ?? 0;
                    const showHeader = currentSessionIndex !== lastSessionIndex;
                    if (showHeader) lastSessionIndex = currentSessionIndex;

                    return (
                      <Fragment key={appointment.id}>
                        {showHeader && (
                          <TableRow className="bg-slate-50 border-y">
                            <TableCell colSpan={6} className="py-2 px-4 font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">
                              Session {currentSessionIndex + 1}
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow className={cn(appointment.status === 'Skipped' && "bg-orange-50/50")}>
                          <TableCell className="font-bold text-slate-700">{appointment.patientName}</TableCell>
                          <TableCell className="text-xs text-slate-500 font-medium">
                            {appointment.age}y • {appointment.sex} • {appointment.place}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-slate-600 italic">Dr. {appointment.doctor}</TableCell>
                          <TableCell className="text-xs">
                            <div className="font-black text-slate-900">{getDisplayTimeForAppointment(appointment)}</div>
                            <div className="text-[10px] text-slate-400">{appointment.date}</div>
                          </TableCell>
                          <TableCell className="font-black text-slate-800">{appointment.tokenNumber}</TableCell>
                          <TableCell className="text-right">
                            {appointment.status === 'Completed' && appointment.prescriptionUrl && (
                              <Button
                                variant="ghost" 
                                size="sm" 
                                className="font-black text-[10px] uppercase text-emerald-600 hover:bg-emerald-50 mr-2"
                                onClick={() => openViewer(appointment.prescriptionUrl!)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View Rx
                              </Button>
                            )}
                            <Button
                              variant="ghost" 
                              size="sm" 
                              className="font-black text-[10px] uppercase text-blue-600 hover:bg-blue-50"
                              onClick={() => { setLayoutMode('registration'); setEditingAppointment(appointment); }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          ) : (
            <div className="space-y-6 py-4">
              {activeTab === 'arrived' && (
                <div className="space-y-2">
                  <Table>
                    <TableBody>
                      {(() => {
                        let lastSessionIndex = -1;
                        return todaysAppointments
                          .filter(apt => apt.status === 'Confirmed')
                          .map((appointment, index) => {
                            const currentSessionIndex = appointment.sessionIndex ?? 0;
                            const showHeader = currentSessionIndex !== lastSessionIndex;
                            if (showHeader) lastSessionIndex = currentSessionIndex;

                            return (
                              <Fragment key={appointment.id}>
                                {showHeader && (
                                  <TableRow className="bg-slate-50/50 border-y">
                                    <TableCell colSpan={2} className="py-1 px-4 font-black text-[9px] uppercase tracking-[0.2em] text-slate-300">
                                      Session {currentSessionIndex + 1}
                                    </TableCell>
                                  </TableRow>
                                )}
                                <TableRow className={cn(appointment.isPriority && "bg-amber-50/50 border-l-4 border-l-amber-500")}>
                                  <TableCell className="font-bold text-slate-700 py-3">
                                    <div className="flex items-center gap-3">
                                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black bg-slate-900 text-white">
                                        {index + 1}
                                      </span>
                                      <span>{appointment.patientName}</span>
                                    </div>
                                    {appointment.prescriptionUrl && (
                                      <div className="mt-2 ml-10">
                                        <Button 
                                          variant="link" 
                                          size="sm" 
                                          onClick={() => openViewer(appointment.prescriptionUrl!)}
                                          className="h-auto p-0 text-[9px] font-black uppercase text-blue-500 hover:no-underline"
                                        >
                                          <Eye className="h-2.5 w-2.5 mr-1" />
                                          Audit Rx Captured
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right py-3">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-full h-9 w-9"
                                      onClick={() => handleComplete(appointment)}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              </Fragment>
                            );
                          });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              )}

              {activeTab === 'pending' && (
                <div className="space-y-2">
                  <Table>
                    <TableBody>
                      {(() => {
                        let lastSessionIndex = -1;
                        return todaysAppointments
                          .filter(apt => (apt.status === 'Pending' || apt.status === 'Skipped'))
                          .map((appointment) => {
                            const currentSessionIndex = appointment.sessionIndex ?? 0;
                            const showHeader = currentSessionIndex !== lastSessionIndex;
                            if (showHeader) lastSessionIndex = currentSessionIndex;

                            return (
                              <Fragment key={appointment.id}>
                                {showHeader && (
                                  <TableRow className="bg-slate-50/50 border-y">
                                    <TableCell colSpan={2} className="py-1 px-4 font-black text-[9px] uppercase tracking-[0.2em] text-slate-300">
                                      Session {currentSessionIndex + 1}
                                    </TableCell>
                                  </TableRow>
                                )}
                                <TableRow>
                                  <TableCell className="font-bold text-slate-700 py-3">{appointment.patientName}</TableCell>
                                  <TableCell className="text-right py-3">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full h-9 w-9"
                                      onClick={() => handleAddToQueue(appointment)}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              </Fragment>
                            );
                          });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
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
