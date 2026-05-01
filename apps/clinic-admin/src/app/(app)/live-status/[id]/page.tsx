'use client';

import { useParams } from "next/navigation";
import { LiveStatusDetailHeader } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLiveStatusDetail } from "@/hooks/use-live-status-detail";

const statusStyles = {
  completed: {
    variant: "success",
    icon: <CheckCircle size={16} className="mr-2" />,
    text: "Completed",
  },
  pending: {
    variant: "warning",
    icon: <Clock size={16} className="mr-2" />,
    text: "Pending",
  },
} as const;

export default function LiveStatusDetailPage() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const { doctor, tokenQueue, loading } = useLiveStatusDetail(id, currentUser);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50/50">
        <LiveStatusDetailHeader />
        <main className="flex-1 p-6 flex items-center justify-center text-muted-foreground animate-pulse font-medium">
          Loading queue details...
        </main>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50/50">
        <LiveStatusDetailHeader />
        <main className="flex-1 p-6 flex items-center justify-center text-red-500 font-bold">
          Doctor profile not found.
        </main>
      </div>
    );
  }

  const currentToken = tokenQueue.pending[0]?.tokenNumber;
  const queueCount = tokenQueue.pending.length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      <LiveStatusDetailHeader />
      <main className="flex-1 p-6">
        <Card className="mb-6 shadow-md border-0 bg-white/80 backdrop-blur-md">
          <CardContent className="p-8">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">{doctor.name}</h2>
                <p className="text-slate-500 font-medium">{doctor.specialty}</p>
              </div>
              <div className="text-right">
                <Badge variant={doctor.availability === 'Available' ? 'success' : 'destructive'} className="font-bold px-3 py-1">
                  {doctor.availability}
                </Badge>
              </div>
            </div>
            <Separator className="my-6 opacity-50" />
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Current Token</p>
                <p className="text-4xl font-black text-primary tracking-tighter">{currentToken || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Patients in Queue</p>
                <p className="text-4xl font-black text-slate-800 tracking-tighter">{queueCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <CardHeader className="bg-slate-50/50 rounded-t-lg">
            <CardTitle className="text-lg font-bold text-slate-800">Queue Grid</CardTitle>
            <CardDescription className="font-medium">Real-time token overview for today.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ScrollArea className="h-[calc(100vh-420px)]">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {tokenQueue.all.map((apt) => {
                  const isCompleted = tokenQueue.completed.some(c => c.id === apt.id);
                  const style = isCompleted ? statusStyles.completed : statusStyles.pending;
                  return (
                    <Badge key={apt.id} variant={style.variant} className="text-base font-bold p-4 flex items-center justify-center shadow-sm border-0">
                      {style.icon}
                      <span>{apt.tokenNumber}</span>
                    </Badge>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
