
"use client";

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parse, subMinutes } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "../ui/skeleton";
import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import { displayTime12h, displayTimeWithBuffer } from "@kloqo/shared-core";

export default function TodaysAppointments({ data, loading, selectedDate }: { data: any[], loading: boolean, selectedDate: Date }) {
  const appointments = data || [];

  return (
    <Card className="h-full flex flex-col bg-[#bcddef]/30">
      <CardHeader>
        <CardTitle>Appointments for {format(selectedDate, "MMMM d")}</CardTitle>
        <CardDescription>First 3 appointments for the selected day.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : appointments.length > 0 ? (
                appointments.map((apt) => (
                  <TableRow key={apt.id || apt.tokenNumber}>
                    <TableCell className="font-medium">{apt.patientName}</TableCell>
                    <TableCell>
                      {(() => {
                        const isWalkIn = apt.tokenNumber?.startsWith('W') || apt.bookedVia === 'Walk-in';
                        return isWalkIn ? displayTime12h(apt.time) : displayTimeWithBuffer(apt.time, 15);
                      })()}
                    </TableCell>
                    <TableCell>{apt.doctor}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          apt.status === "Confirmed"
                            ? "success"
                            : apt.status === "Pending"
                              ? "warning"
                              : apt.status === "Completed"
                                ? "success"
                                : "destructive"
                        }
                      >
                        {apt.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No appointments scheduled for this day.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
      <CardFooter className="pt-4 justify-end">
        <Button asChild variant="link" className="text-primary">
          <Link href="/appointments?drawer=open">
            View All
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
