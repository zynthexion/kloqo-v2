
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { format } from "date-fns";
import { Button } from "../ui/button";
import Link from "next/link";
import { Star, Users, Clock } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

export default function DoctorAvailability({ data, loading, selectedDate }: { data: any[], loading: boolean, selectedDate: Date }) {
  const availableDoctors = data || [];

  const StarRating = ({ rating }: { rating: number }) => (
    <div className="flex items-center">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );

  return (
    <Card className="h-full flex flex-col bg-[#bcddef]/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Available Doctors</CardTitle>
          <CardDescription>
            For {format(selectedDate, "MMMM d, yyyy")}.
          </CardDescription>
        </div>
        <Button variant="link" asChild className="text-primary">
            <Link href="/doctors">See All</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-grow overflow-auto">
        <ScrollArea className="h-full">
            <div className="space-y-3 pr-3">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center">Loading...</p>
            ) : availableDoctors.length > 0 ? (
                availableDoctors.map((doctor) => {
                    const appointmentCount = doctor.appointmentCount || 0;
                    const tendsToRunLate = doctor.historicalData?.toLowerCase().includes('late');
                    return (
                        <Card key={doctor.id} className="p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                     <Avatar className="h-10 w-10">
                                         <AvatarImage src={doctor.avatar} alt={doctor.name} data-ai-hint="doctor portrait" />
                                         <AvatarFallback>{doctor.name?.charAt(0)}</AvatarFallback>
                                     </Avatar>
                                    <div>
                                        <Link href={`/doctors?id=${doctor.id}`} className="font-semibold text-sm hover:underline">{doctor.name}</Link>
                                        <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
                                        <StarRating rating={doctor.rating || 0} />
                                    </div>
                                </div>
                                {appointmentCount > 0 && (
                                 <Badge variant="secondary" className="font-semibold">
                                    <Users className="h-3 w-3 mr-1.5" />
                                    {appointmentCount} {appointmentCount > 1 ? 'appointments' : 'appointment'}
                                </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                               <Badge variant={doctor.consultationStatus === 'In' ? 'success' : 'destructive'} className="text-xs">
                                  {doctor.consultationStatus || 'Out'}
                                </Badge>
                               {tendsToRunLate && (
                                  <Badge variant="warning" className="text-xs">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Runs Late
                                  </Badge>
                               )}
                            </div>
                        </Card>
                    )
                })
            ) : (
                <div className="flex items-center justify-center h-full pt-10">
                    <p className="text-sm text-muted-foreground text-center">No doctors scheduled for this day.</p>
                </div>
            )}
            </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

    