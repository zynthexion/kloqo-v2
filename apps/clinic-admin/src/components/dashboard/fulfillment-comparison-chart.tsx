"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import { MessageSquare, Printer, TrendingUp } from "lucide-react";

interface FulfillmentComparisonChartProps {
  whatsappRate: number;
  printedRate: number;
  loading: boolean;
}

export default function FulfillmentComparisonChart({ whatsappRate, printedRate, loading }: FulfillmentComparisonChartProps) {
  const data = [
    { name: "WhatsApp Rx", rate: whatsappRate, color: "#10b981", icon: MessageSquare },
    { name: "Printed Rx", rate: printedRate, color: "#f43f5e", icon: Printer },
  ];

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest">Kloqo ROI Analysis</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  const lift = whatsappRate > 0 && printedRate > 0 
    ? Math.round(((whatsappRate - printedRate) / printedRate) * 100)
    : 0;

  return (
    <Card className="h-full border-primary/20 bg-primary/[0.02] shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-primary uppercase tracking-widest">Kloqo ROI: Fulfillment Lift</CardTitle>
            <CardDescription className="text-[10px] font-medium mt-1">WhatsApp Rx vs. Walk-out Risk (Printed)</CardDescription>
          </div>
          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }}
              />
              <YAxis hide domain={[0, 100]} />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-2 shadow-lg border rounded-lg text-xs font-bold">
                        {payload[0].value}% Fulfillment
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]} barSize={50}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <LabelList 
                  dataKey="rate" 
                  position="top" 
                  formatter={(v: number) => `${v}%`}
                  style={{ fontSize: 14, fontWeight: 900, fill: '#1e293b' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {lift > 0 && (
          <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
            <p className="text-xs text-emerald-800 font-bold flex items-center gap-2">
              <TrendingUp className="h-3 w-3" />
              WhatsApp Rx yields a {lift}% higher conversion than Printed Rx.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
