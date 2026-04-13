
"use client";

import Link from "next/link";
import { LiveStatusHeader } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Maximize, ZoomIn, ZoomOut, Users, Clock, Hourglass, Ticket } from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import { useSSE } from "@/hooks/use-sse";
import type { Doctor, Appointment } from '@kloqo/shared';
import { cn, parseTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format, parse, isToday, differenceInMinutes } from "date-fns";
import { compareAppointments } from '@kloqo/shared-core';

type EnrichedDoctor = Doctor & {
  currentToken?: string;
  pendingTokens: number;
  delayMinutes?: number;
};

const DoctorStatusCard = ({ data }: { data: EnrichedDoctor }) => {
  const isAvailable = data.consultationStatus === "In";

  return (
    <Link href={`/live-status/${data.id}`}>
      <Card
        className={cn(
          "p-4 flex flex-col justify-between h-full shadow-md hover:shadow-xl transition-shadow border-l-4",
          isAvailable ? "border-green-500" : "border-red-500"
        )}
      >
        <div>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">{data.name}</h3>
              <p className="text-sm text-muted-foreground">{data.specialty}</p>
            </div>
            <div className={cn(
              "px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1",
              isAvailable ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            )}>
              <div className={cn("h-2 w-2 rounded-full", isAvailable ? "bg-green-500" : "bg-red-500")} />
              {data.consultationStatus}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {isAvailable ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Current</p>
                    <p className="font-bold">{data.currentToken || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">In Queue</p>
                    <p className="font-bold">{data.pendingTokens}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Hourglass className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Est. Delay</p>
                  <p className={cn("font-bold", (data.delayMinutes ?? 0) > 10 ? "text-red-500" : "text-green-600")}>
                    {data.delayMinutes !== undefined ? `${data.delayMinutes} min` : 'N/A'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div>
              <p className="font-bold text-lg text-red-500">UNAVAILABLE</p>
              <p className="text-sm text-muted-foreground">
                Currently not accepting appointments.
              </p>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
};


const ZoomControls = () => (
  <div className="fixed right-6 bottom-6 flex flex-col gap-1">
    <Card className="p-0 flex flex-col gap-0 rounded-md overflow-hidden border">
      <Button variant="ghost" size="icon" className="rounded-none">
        <ZoomIn className="h-5 w-5" />
      </Button>
      <hr />
      <Button variant="ghost" size="icon" className="rounded-none">
        <ZoomOut className="h-5 w-5" />
      </Button>
      <hr />
      <Button variant="ghost" size="icon" className="rounded-none">
        <Maximize className="h-5 w-5" />
      </Button>
    </Card>
  </div>
);

export default function LiveStatusPage() {
  const { currentUser } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const todayStr = format(new Date(), "d MMMM yyyy");
      const [doctorsData, appointmentsData] = await Promise.all([
        apiRequest<Doctor[]>('/clinic/doctors'),
        apiRequest<Appointment[]>(`/clinic/appointments?date=${todayStr}`)
      ]);

      setDoctors(doctorsData);
      setAppointments(appointmentsData);
    } catch (error) {
      console.error("Error fetching live status data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SSE: Real-time updates instead of 30s polling
  useSSE({
    clinicId: currentUser?.clinicId,
    onEvent: useCallback((event) => {
      if (['appointment_status_changed', 'walk_in_created', 'queue_updated', 'token_called'].includes(event.type)) {
        fetchData();
      }
    }, [fetchData])
  });

  // Keep the 1-minute timer purely for UI clock updates (no network hit)
  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timerId);
  }, []);

  const enrichedDoctors: EnrichedDoctor[] = useMemo(() => {
    return doctors.map(doctor => {
      const doctorAppointments = appointments
        .filter(apt => apt.doctor === doctor.name && isToday(parse(apt.date, 'd MMMM yyyy', new Date())))
        .sort(compareAppointments);

      const pending = doctorAppointments.filter(apt => ['Pending', 'Confirmed'].includes(apt.status));
      const currentAppointment = pending[0];

      let delayMinutes: number | undefined;
      if (currentAppointment) {
        try {
          const appointmentTime = parseTime(currentAppointment.time, new Date());
          const diff = differenceInMinutes(currentTime, appointmentTime);
          delayMinutes = Math.max(0, diff); // Only show non-negative delay
        } catch {
          delayMinutes = undefined;
        }
      }

      return {
        ...doctor,
        currentToken: currentAppointment?.tokenNumber,
        pendingTokens: pending.length,
        delayMinutes,
      }
    })
  }, [doctors, appointments, currentTime]);

  return (
    <>
      <div className="flex flex-col">
        <LiveStatusHeader />
        <main className="flex-1 p-4 sm:p-6 relative">
          {loading ? (
            <p>Loading doctors...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {enrichedDoctors.map((doctor) => (
                <DoctorStatusCard key={doctor.id} data={doctor} />
              ))}
            </div>
          )}
          <ZoomControls />
        </main>
      </div>
    </>
  );
}
