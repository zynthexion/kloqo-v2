"use client";

import { DateRange } from "react-day-picker";
import { 
  Users, 
  Stethoscope, 
  XCircle, 
  CheckCircle, 
  CalendarClock,
  TrendingUp,
  Receipt,
  ArrowRightLeft,
  LayoutDashboard
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Stat = {
  title: string;
  value: string | number;
  icon: string;
  change?: string;
  changeType?: 'increase' | 'decrease';
}

const iconMap: { [key: string]: { component: React.ElementType, color: string } } = {
  "Total Patients": { component: Users, color: "text-cyan-500" },
  "Total Doctors": { component: Stethoscope, color: "text-fuchsia-500" },
  "Cancelled": { component: XCircle, color: "text-red-500" },
  "Completed Appointments": { component: CheckCircle, color: "text-green-500" },
  "Total Revenue": { component: TrendingUp, color: "text-emerald-500" },
  "Upcoming": { component: CalendarClock, color: "text-amber-500" },
  "Total Rx Value": { component: Receipt, color: "text-blue-500" },
  "Fulfillment Rate": { component: CheckCircle, color: "text-indigo-500" },
  "Walk-Outs": { component: ArrowRightLeft, color: "text-orange-500" },
};

type OverviewStatsProps = {
  data?: {
    roi?: {
      revenueCaptured: number;
      totalRxValue: number;
      walkOutsCount: number;
      fulfillmentRate: number;
    };
    current: {
      totalPatients: number;
      completedAppointments: number;
      cancelledAppointments: number;
      totalRevenue: number;
      totalDoctors: number;
    };
  };
  comparison?: {
    patientsChange: string;
    appointmentsChange: string;
    revenueChange: string;
    cancelledChange: string;
  };
  loading: boolean;
  dateRange?: DateRange;
  doctorId?: string;
  isAdmin: boolean;
};

export default function OverviewStats({ data, comparison, loading, isAdmin }: OverviewStatsProps) {
  const allStats: Stat[] = [
    {
      title: "Revenue Captured",
      value: `₹${(data?.roi?.revenueCaptured || 0).toLocaleString()}`,
      icon: "Total Revenue",
      change: comparison?.revenueChange,
      changeType: comparison?.revenueChange?.startsWith('+') ? 'increase' : 'decrease'
    },
    {
      title: "Total Rx Value",
      value: `₹${(data?.roi?.totalRxValue || 0).toLocaleString()}`,
      icon: "Total Rx Value",
      change: "+12%", 
      changeType: 'increase'
    },
    {
      title: "Fulfillment Rate",
      value: `${data?.roi?.fulfillmentRate || 0}%`,
      icon: "Fulfillment Rate",
    },
    {
      title: "Walk-Outs",
      value: data?.roi?.walkOutsCount || 0,
      icon: "Walk-Outs",
    },
    {
      title: "Total Patients",
      value: data?.current?.totalPatients || 0,
      icon: "Total Patients",
    },
    {
      title: "Total Doctors",
      value: data?.current?.totalDoctors || 0,
      icon: "Total Doctors"
    },
  ];

  // ✅ RBAC: Filter out financial metrics for non-admin clinical staff
  const stats = isAdmin 
    ? allStats 
    : allStats.filter(s => !["Revenue Captured", "Total Rx Value", "Fulfillment Rate", "Walk-Outs"].includes(s.title));

  const getCardClass = (title: string) => {
    if (["Revenue Captured", "Total Rx Value", "Fulfillment Rate", "Walk-Outs"].includes(title)) {
      return "shadow-md border-primary/20 bg-primary/5";
    }
    return "shadow-sm border-slate-100";
  }

  return (
    <div className={cn(
      "grid gap-4",
      isAdmin 
        ? "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" 
        : "sm:grid-cols-2 lg:grid-cols-2"
    )}>
      {stats.map((stat) => {
        const { component: Icon, color } = iconMap[stat.icon as keyof typeof iconMap] || { component: Users, color: "text-muted-foreground" };
        return (
          <Card key={stat.title} className={cn("text-center transition-all hover:shadow-md", getCardClass(stat.title))}>
            <CardHeader className="flex flex-col items-center space-y-1 pb-2">
              <Icon className={cn("h-5 w-5", color)} />
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-black text-slate-800">{stat.value}</div>
              {stat.change && (
                <p className={cn(
                  "text-[10px] mt-1 font-bold",
                  stat.changeType === 'increase' ? 'text-emerald-600' : 'text-red-500'
                )}>
                  {stat.change}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
