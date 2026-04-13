
"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { Skeleton } from "../ui/skeleton";

type PeakHoursChartProps = {
  data: { hour: number; count: number }[] | Record<number, number>;
  loading: boolean;
};

export default function PeakHoursChart({ data, loading }: PeakHoursChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];

    let processedData = [];
    if (Array.isArray(data)) {
      processedData = data.map(d => ({
        hour: d.hour,
        name: format(new Date(0, 0, 0, d.hour), 'ha'),
        count: d.count,
      }));
    } else {
      processedData = Object.entries(data)
        .map(([hour, count]) => ({
          hour: parseInt(hour),
          name: format(new Date(0, 0, 0, parseInt(hour)), 'ha'),
          count: count as number,
        }));
    }

    return processedData
      .sort((a, b) => a.hour - b.hour)
      .filter(d => d.hour >= 6 && d.hour <= 22); // Filter for typical business hours
  }, [data]);
  
  if (loading) {
    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="flex-grow flex items-center justify-center">
                 <Skeleton className="h-full w-full" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Peak Hours</CardTitle>
        <CardDescription>Appointment distribution by hour.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex items-center justify-center pr-6">
        {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                    <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip
                        contentStyle={{
                            background: "hsl(var(--background))",
                            borderRadius: "var(--radius)",
                            border: "1px solid hsl(var(--border))",
                        }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--chart-1))" name="Appointments" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        ) : (
             <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                 <p className="text-sm">No appointment data to display for this period.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
