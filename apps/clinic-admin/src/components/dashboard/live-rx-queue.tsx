"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle, MessageSquare, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface LiveRxQueueProps {
  data: any[];
  loading: boolean;
}

export default function LiveRxQueue({ data, loading }: LiveRxQueueProps) {
  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Live Prescription Queue</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col shadow-lg border-primary/10">
      <CardHeader className="pb-3 border-b bg-slate-50/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Live Prescription Queue
          </CardTitle>
          <Badge variant="outline" className="bg-white">{data?.length || 0} Waiting</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-0 overflow-y-auto max-h-[400px]">
        {(!data || data.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400">
            <CheckCircle2 className="h-12 w-12 mb-2 opacity-20" />
            <p className="text-sm font-medium">Queue is clear</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.map((rx) => (
              <div key={rx.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{rx.patientName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Dr. {rx.doctorName}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    {rx.status === 'ISSUED_WHATSAPP' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        WhatsApp
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200 flex items-center gap-1 animate-pulse">
                        <Printer className="h-3 w-3" />
                        Counter
                      </Badge>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1 font-medium italic">
                      {formatDistanceToNow(new Date(rx.createdAt?.toDate ? rx.createdAt.toDate() : rx.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {data?.some(rx => rx.status === 'ISSUED_PRINTED') && (
        <div className="p-3 bg-red-50 border-t border-red-100 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 font-medium">
            <span className="font-bold">Interception Required:</span> Patients with printed prescriptions are likely to walk out. Counter staff should engage immediately.
          </p>
        </div>
      )}
    </Card>
  );
}
