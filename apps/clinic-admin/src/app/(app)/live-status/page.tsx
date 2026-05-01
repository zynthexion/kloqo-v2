'use client';

import Link from "next/link";
import { LiveStatusHeader } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Maximize, ZoomIn, ZoomOut, Users, Hourglass, Ticket } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLiveStatus, type EnrichedDoctor } from "@/hooks/use-live-status";

const DoctorStatusCard = ({ data }: { data: EnrichedDoctor }) => {
  const isAvailable = data.consultationStatus === "In";

  return (
    <Link href={`/live-status/${data.id}`}>
      <Card className={cn(
          "p-4 flex flex-col justify-between h-full shadow-md hover:shadow-xl transition-shadow border-l-4",
          isAvailable ? "border-green-500" : "border-red-500"
        )}>
        <div>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">{data.name}</h3>
              <p className="text-sm text-muted-foreground">{data.specialty}</p>
            </div>
            <div className={cn("px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1", isAvailable ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
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
              <p className="font-bold text-lg text-red-500 uppercase tracking-tighter">Unavailable</p>
              <p className="text-sm text-muted-foreground">Doctor not in consultation.</p>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
};

const ZoomControls = () => (
  <div className="fixed right-6 bottom-6 flex flex-col gap-1">
    <Card className="p-0 flex flex-col rounded-md overflow-hidden border shadow-lg">
      <Button variant="ghost" size="icon" className="rounded-none"><ZoomIn className="h-5 w-5" /></Button>
      <hr />
      <Button variant="ghost" size="icon" className="rounded-none"><ZoomOut className="h-5 w-5" /></Button>
      <hr />
      <Button variant="ghost" size="icon" className="rounded-none"><Maximize className="h-5 w-5" /></Button>
    </Card>
  </div>
);

export default function LiveStatusPage() {
  const { currentUser } = useAuth();
  const { enrichedDoctors, loading } = useLiveStatus(currentUser);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      <LiveStatusHeader />
      <main className="flex-1 p-6 relative">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse font-medium">
            Fetching real-time status...
          </div>
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
  );
}
