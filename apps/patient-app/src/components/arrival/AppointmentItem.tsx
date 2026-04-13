'use client';

import { type Appointment, type Doctor } from '@kloqo/shared';
import { format, parse, subMinutes, addMinutes, isBefore } from 'date-fns';
import { getArriveByTimeFromAppointment, parseTime } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Clock, ChevronUp, ChevronDown, UserPlus, AlertCircle, Loader2 } from 'lucide-react';

interface AppointmentItemProps {
  appointment: Appointment;
  doctors: Doctor[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  isConfirmed: boolean;
  t: any;
  lateMinutesForAppointment?: number;
  onUpdateLateMinutes?: (minutes: number) => void;
  isUpdatingLate?: boolean;
  onConfirmArrival: () => void;
  isConfirming: boolean;
  isLocationValid: boolean;
  type: 'pending' | 'skipped';
}

export function AppointmentItem({
  appointment,
  doctors,
  isExpanded,
  onToggleExpand,
  isConfirmed,
  t,
  lateMinutesForAppointment = 0,
  onUpdateLateMinutes,
  isUpdatingLate = false,
  onConfirmArrival,
  isConfirming,
  isLocationValid,
  type
}: AppointmentItemProps) {
  const appointmentDate = parse(appointment.date, 'd MMMM yyyy', new Date());
  const appointmentTime = parseTime(appointment.time, appointmentDate);
  const reportingTime = subMinutes(appointmentTime, 15);
  const now = new Date();

  // Common logic
  const canConfirm = type === 'pending' ? isBefore(now, reportingTime) : true;
  const canUpdateLate = type === 'skipped' ? isBefore(now, appointmentTime) : false;
  
  const maxLateTime = lateMinutesForAppointment > 0
    ? addMinutes(reportingTime, lateMinutesForAppointment)
    : reportingTime;

  // Cut-off time calculation for pending
  let cutOffTimeDisplay = '--';
  if (type === 'pending' && (appointment as any).cutOffTime) {
    try {
      const cot = (appointment as any).cutOffTime;
      let cutOffDate: Date;
      if (typeof cot?.toDate === 'function') {
        cutOffDate = cot.toDate();
      } else if (cot instanceof Date) {
        cutOffDate = cot;
      } else {
        cutOffDate = new Date(cot);
      }
      cutOffTimeDisplay = format(cutOffDate, 'hh:mm a');
    } catch {
      cutOffTimeDisplay = '--';
    }
  }

  return (
    <Card className={type === 'skipped' ? "border-2 border-orange-200" : "border-2"}>
      <CardContent className="p-4 space-y-3">
        <div
          className="flex items-start justify-between cursor-pointer"
          onClick={onToggleExpand}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{appointment.patientName}</h3>
              {isConfirmed && (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Age: {appointment.age} {appointment.place && `• ${appointment.place}`}
            </p>
            {isExpanded && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-muted-foreground">
                  Doctor: {appointment.doctor}
                </p>
                <p className="text-sm text-muted-foreground">
                  Department: {appointment.department}
                </p>
                <p className="text-sm">
                  <Clock className="inline h-4 w-4 mr-1" />
                  {t.home.arriveBy}: {(() => {
                    const appointmentDoctor = doctors.find(d => d.name === appointment.doctor);
                    return getArriveByTimeFromAppointment(appointment, appointmentDoctor);
                  })()}
                </p>
                {appointment.delay && appointment.delay > 0 && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    ⏱️ Delayed by {appointment.delay} min
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Token: {appointment.tokenNumber}
                </p>
                {type === 'skipped' && lateMinutesForAppointment > 0 && (
                  <p className="text-sm text-orange-600">
                    Late minutes: {lateMinutesForAppointment} min (No-show after: {format(maxLateTime, 'hh:mm a')})
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isExpanded && type === 'pending' && (
              <p className="text-sm text-muted-foreground">
                Report by: {cutOffTimeDisplay}
              </p>
            )}
            {!isExpanded && type === 'skipped' && (
              <Badge variant="destructive">{appointment.status}</Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
        
        {isExpanded && type === 'pending' && (
          <>
            <div className="flex items-center justify-end">
              <p className="text-sm text-muted-foreground">
                Report by: {cutOffTimeDisplay}
              </p>
            </div>
            <Button
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onConfirmArrival();
              }}
              disabled={!isLocationValid || isConfirming || !canConfirm}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : !canConfirm ? (
                <>
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Too Late - Appointment Skipped
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm Arrival
                </>
              )}
            </Button>
            {!canConfirm && (
              <p className="text-sm text-destructive text-center mt-2">
                You must confirm before the cut-off time. Please use the "Rejoin Queue" option below once your appointment is skipped.
              </p>
            )}
          </>
        )}

        {isExpanded && type === 'skipped' && (
          <>
            <div className="flex items-center justify-end">
              <Badge variant="destructive">{appointment.status}</Badge>
            </div>
            {canUpdateLate && onUpdateLateMinutes && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Update Late Minutes</label>
                <Select
                  value={lateMinutesForAppointment.toString()}
                  onValueChange={(value) => onUpdateLateMinutes(parseInt(value))}
                  disabled={isUpdatingLate}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select late minutes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="20">20 minutes</SelectItem>
                    <SelectItem value="25">25 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onConfirmArrival();
              }}
              disabled={!isLocationValid || isConfirming}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejoining Queue...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Rejoin Queue
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
