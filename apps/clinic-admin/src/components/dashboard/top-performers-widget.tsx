"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, User, Award, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface ProviderPerformance {
  doctorId: string;
  name: string;
  totalRevenue: number;
  fulfillmentRate: number;
}

interface TopPerformersWidgetProps {
  data?: ProviderPerformance[];
  loading: boolean;
}

export default function TopPerformersWidget({ data, loading }: TopPerformersWidgetProps) {
  // We only show the top 3 for the widget
  const topPerformers = data?.slice(0, 3) || [];

  return (
    <Card className="h-full border-slate-100 shadow-sm overflow-hidden flex flex-col">
      <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-tight">Top Performers</CardTitle>
        </div>
        <Link 
          href="/dashboard/reports/providers" 
          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5"
        >
          View All <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      
      <CardContent className="p-0 flex-grow">
        {loading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : topPerformers.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {topPerformers.map((doctor, index) => (
              <div 
                key={doctor.doctorId} 
                className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm",
                    index === 0 ? "bg-amber-100 text-amber-600" : 
                    index === 1 ? "bg-slate-100 text-slate-600" : 
                    "bg-orange-100 text-orange-600"
                  )}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 leading-none mb-1">{doctor.name}</p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Fulfillment: <span className={cn(
                        doctor.fulfillmentRate < 50 ? "text-red-500" : "text-emerald-600"
                      )}>{doctor.fulfillmentRate}%</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">₹{(doctor.totalRevenue).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Today's Revenue</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <TrendingUp className="h-8 w-8 text-slate-200 mb-2" />
            <p className="text-xs font-medium text-slate-400">No data available for today</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
