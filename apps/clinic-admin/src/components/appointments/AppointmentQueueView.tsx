import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Footprints, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Fragment } from "react";
import type { Appointment } from "@kloqo/shared";

interface AppointmentQueueViewProps {
  activeTab: string;
  appointments: Appointment[];
  openViewer: (url: string) => void;
  handleComplete: (appt: Appointment) => void;
  handleStart: (appt: Appointment) => void;
  handleAddToQueue: (appt: Appointment) => void;
}

export function AppointmentQueueView({
  activeTab,
  appointments,
  openViewer,
  handleComplete,
  handleStart,
  handleAddToQueue
}: AppointmentQueueViewProps) {
  let lastSessionIndex = -1;

  const filtered = appointments.filter(apt => {
    if (activeTab === 'arrived') return ['Confirmed', 'InConsultation'].includes(apt.status);
    if (activeTab === 'pending') return apt.status === 'Pending';
    if (activeTab === 'skipped') return ['Skipped', 'No-show'].includes(apt.status);
    return false;
  });

  return (
    <div className="space-y-6 py-4">
      <Table>
        <TableBody>
          {filtered.map((appointment, index) => {
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
                <TableRow className={cn(
                  appointment.isPriority && "bg-amber-50/50 border-l-4 border-l-amber-500",
                  appointment.isNextLocked && "bg-indigo-50/50 border-l-4 border-l-indigo-600",
                  (appointment as any).isInBuffer && !appointment.isPriority && !appointment.isNextLocked && "bg-blue-50/50 border-l-4 border-l-blue-500",
                  activeTab === 'skipped' && "bg-orange-50/20"
                )}>
                  <TableCell className="font-bold text-slate-700 py-3">
                    <div className="flex items-center gap-3">
                      {activeTab === 'arrived' && (
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black bg-slate-900 text-white">
                          {index + 1}
                        </span>
                      )}
                      <span>{appointment.patientName}</span>
                      {(appointment as any).isInBuffer && !appointment.isPriority && !appointment.isNextLocked && (
                        <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-700 border-blue-200 text-[8px] uppercase px-1 py-0 rounded animate-pulse">
                          Ready
                        </Badge>
                      )}
                      {appointment.isNextLocked && (
                        <Badge variant="default" className="ml-2 bg-indigo-600 text-white border-indigo-700 text-[8px] uppercase px-1 py-0 rounded animate-pulse">
                          At Door
                        </Badge>
                      )}
                      {activeTab === 'skipped' && (
                        <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-600 border-yellow-200 text-[8px] uppercase px-1 py-0 rounded">
                          {appointment.status}
                        </Badge>
                      )}
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
                    {activeTab === 'arrived' ? (
                      appointment.status === 'InConsultation' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-full h-9 w-9"
                          onClick={() => handleComplete(appointment)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full h-9 w-9"
                            onClick={() => handleStart(appointment)}
                          >
                            <Footprints className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-full h-9 w-9 opacity-30 cursor-not-allowed"
                            disabled
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "rounded-full h-9 w-9",
                          activeTab === 'pending' ? "text-blue-600 bg-blue-50 hover:bg-blue-100" : "text-amber-600 bg-amber-50 hover:bg-amber-100"
                        )}
                        onClick={() => handleAddToQueue(appointment)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
