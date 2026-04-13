
"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Appointment, Doctor } from '@kloqo/shared';
import { format, parse, subMinutes } from "date-fns";
import { apiRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { compareAppointments } from '@kloqo/shared-core';

export default function UpcomingAppointmentsDrawer() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);

        const fetchData = async () => {
            try {
                const [doctorsList, allAppts] = await Promise.all([
                    apiRequest<Doctor[]>('/clinic/doctors'),
                    apiRequest<Appointment[]>('/clinic/appointments')
                ]);
                
                setDoctors(doctorsList || []);

                const todayStr = format(new Date(), "d MMMM yyyy");
                // Filter for today or future appointments
                const upcoming = (allAppts || [])
                    .filter(a => a.date === todayStr || new Date(a.date) >= new Date())
                    .sort(compareAppointments);

                setAppointments(upcoming.slice(0, 5));
            } catch (error) {
                console.error("Error fetching upcoming appointments:", error);
            }
        };

        fetchData();
    }, []);

    const getDoctorAvatar = (doctorName: string) => {
        const defaultDoctorImage = "https://firebasestorage.googleapis.com/v0/b/kloqo-nurse-dup-43384903-8d386.firebasestorage.app/o/doctor_male.webp?alt=media&token=b19d8fb5-1812-4eb5-a879-d48739eaa87e";
        const doctor = doctors.find(d => d.name === (doctorName || ''));
        return doctor ? doctor.avatar : defaultDoctorImage;
    }

    return (
        <div className="group fixed right-6 top-1/2 -translate-y-1/2 z-50">
            <div className="relative h-12 w-12 flex items-center justify-center">
                {/* Drawer Content - Hidden by default, shown on group-hover */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 group-hover:w-[400px] transition-all duration-300 ease-in-out opacity-0 group-hover:opacity-100">
                    <Card className="h-[500px] flex flex-col shadow-2xl origin-right transition-transform duration-300 ease-in-out transform group-hover:scale-x-100 scale-x-0">
                        <CardHeader>
                            <CardTitle>Upcoming Appointments</CardTitle>
                            <CardDescription>Your next 5 scheduled appointments.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-hidden">
                            <ScrollArea className="h-full pr-4">
                                <div className="space-y-4">
                                    {isClient && (appointments.length > 0 ? appointments.map((apt) => (
                                        <div key={apt.id || apt.tokenNumber} className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50">
                                            <Image
                                                src={getDoctorAvatar(apt.doctor || '') || '/default-doctor.png'}
                                                alt={apt.doctor || ''}
                                                width={40}
                                                height={40}
                                                className="rounded-full"
                                                data-ai-hint="doctor portrait"
                                            />
                                            <div className="flex-grow">
                                                <p className="font-semibold text-sm">{apt.patientName}</p>
                                                <p className="text-xs text-muted-foreground">with {apt.doctor || 'Doctor'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium">
                                                    {(() => {
                                                        try {
                                                            const isWalkIn = apt.tokenNumber?.startsWith('W') || apt.bookedVia === 'Walk-in';
                                                            if (isWalkIn) return apt.time;
                                                            const aptDate = parse(apt.date, "d MMMM yyyy", new Date());
                                                            const aptTime = parse(`1970/01/01 ${apt.time}`, "yyyy/MM/dd hh:mm a", new Date());
                                                            const finalTime = subMinutes(aptTime, 15);
                                                            return format(finalTime, 'hh:mm a');
                                                        } catch {
                                                            return apt.time;
                                                        }
                                                    })()}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{format(new Date(apt.date || new Date()), "MMM d")}</p>
                                            </div>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-muted-foreground text-center py-8">No upcoming appointments.</p>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* Icon - Always Visible */}
                <div className={cn(
                    "absolute top-1/2 right-0 -translate-y-1/2 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg",
                    "transition-all duration-300 ease-in-out cursor-pointer",
                    "group-hover:rounded-l-none group-hover:right-[388px]" // 400px (width) - 12px (half-width of icon) is not quite right, let's adjust
                )}>
                    <CalendarDays className="h-6 w-6" />
                </div>
            </div>
        </div>
    );
}
