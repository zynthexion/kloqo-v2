import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Fragment } from "react";
import type { Appointment } from "@kloqo/shared";

interface AppointmentTableProps {
  appointments: Appointment[];
  getDisplayTimeForAppointment: (appt: Appointment) => string;
  openViewer: (url: string) => void;
  setEditingAppointment: (appt: Appointment) => void;
  setLayoutMode: (mode: 'registration' | 'monitoring' | 'records') => void;
}

export function AppointmentTable({ 
  appointments, 
  getDisplayTimeForAppointment, 
  openViewer, 
  setEditingAppointment,
  setLayoutMode
}: AppointmentTableProps) {
  let lastSessionIndex = -1;

  return (
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
        {appointments.map((appointment) => {
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
                <TableCell>
                  {appointment.status === 'InConsultation' && (
                    <Badge className="bg-blue-600 animate-pulse text-[8px] font-black uppercase">In Room</Badge>
                  )}
                  {appointment.status === 'Confirmed' && (
                    <Badge variant="outline" className="text-[8px] font-black uppercase">Arrived</Badge>
                  )}
                  {appointment.status === 'Completed' && (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[8px] font-black uppercase">Done</Badge>
                  )}
                </TableCell>
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
        })}
      </TableBody>
    </Table>
  );
}
