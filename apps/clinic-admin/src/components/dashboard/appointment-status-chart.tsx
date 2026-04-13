

"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Skeleton } from "../ui/skeleton";

const COLORS = {
  completed: "hsl(var(--chart-2))",
  upcoming: "hsl(var(--chart-1))",
  cancelled: "hsl(var(--chart-3))",
  "No-show": "hsl(var(--muted-foreground))",
};

const ALL_STATUSES = ["completed", "upcoming", "cancelled", "No-show"];

const statusLabels: { [key: string]: string } = {
  completed: "Completed",
  upcoming: "Upcoming",
  cancelled: "Cancelled",
  "No-show": "No-show",
};

type AppointmentStatusChartProps = {
  data: any;
  loading: boolean;
  dateRange?: any;
  doctorId?: string;
};

export default function AppointmentStatusChart({ data, loading }: AppointmentStatusChartProps) {
  const chartData = useMemo(() => {
    if (!data?.current) return [];

    const { completedAppointments, upcomingAppointments, cancelledAppointments, noShowAppointments } = data.current;

    return [
      { name: "completed", value: completedAppointments },
      { name: "upcoming", value: upcomingAppointments },
      { name: "cancelled", value: cancelledAppointments },
      { name: "No-show", value: noShowAppointments },
    ].filter(item => item.value > 0);
  }, [data]);

  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <Skeleton className="h-48 w-48 rounded-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-6 w-full" />
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Appointment Overview</CardTitle>
        <CardDescription>Status of appointments in the selected period.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex items-center justify-center p-0">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--background))",
                  borderRadius: "var(--radius)",
                  border: "1px solid hsl(var(--border))",
                }}
                labelFormatter={(value) => statusLabels[value as string]}
              />
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                innerRadius={70}
                paddingAngle={5}
                dataKey="value"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground">No appointment data for this period.</p>
        )}
      </CardContent>
      {chartData.length > 0 && (
        <CardFooter className="flex-col gap-4 text-sm pt-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {ALL_STATUSES.map(status => (
              <div key={status} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[status as keyof typeof COLORS] }} />
                <span className="text-muted-foreground">{statusLabels[status]}</span>
              </div>
            ))}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
