
"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton } from "../ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

type ChartProps = {
  data?: any[];
  loading?: boolean;
  dateRange?: any;
};


export default function PatientsVsAppointmentsChart({ data, loading }: ChartProps) {
  if (loading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data || [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Analytics Overview</CardTitle>
        <CardDescription>Patient visits and revenue over time.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex items-center justify-center pr-6">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorNewPatients" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorReturningPatients" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--background))",
                  borderRadius: "var(--radius)",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ top: -10, right: 0 }}
              />
              <Area type="monotone" dataKey="newPatients" stroke="hsl(var(--chart-1))" fill="url(#colorNewPatients)" strokeWidth={2} name="New Patients" />
              <Area type="monotone" dataKey="returningPatients" stroke="hsl(var(--chart-2))" fill="url(#colorReturningPatients)" strokeWidth={2} name="Returning Patients" />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-3))" fill="url(#colorRevenue)" strokeWidth={2} name="Revenue (₹)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <p className="text-sm">Not enough data to display chart for this period.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
