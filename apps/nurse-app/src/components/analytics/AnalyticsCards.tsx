'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  CheckCircle2,
  AlertCircle,
  Activity,
  Calendar,
  XCircle,
  Clock,
  ChevronDown
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: {
    value: string;
    isUp: boolean;
  };
  icon: React.ElementType;
  color: string;
  className?: string;
}

export function StatCard({ title, value, subtitle, trend, icon: Icon, color, className }: StatCardProps) {
  return (
    <div className={cn("p-8 rounded-[2.5rem] bg-white shadow-premium border border-slate-50 flex flex-col justify-between group hover:shadow-2xl transition-all duration-500", className)}>
      <div className="flex justify-between items-start">
        <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110 duration-500", color)}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black",
            trend.isUp ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
          )}>
            {trend.isUp ? <ArrowUpRight className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
            {trend.value}
          </div>
        )}
      </div>
      <div className="mt-8">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-4xl font-black text-slate-900 mt-2 tracking-tighter">{value}</h3>
        <p className="text-sm font-medium text-slate-500 mt-2">{subtitle}</p>
      </div>
    </div>
  );
}

export function EfficiencyGauge({ percentage, label }: { percentage: number, label: string }) {
  const radius = 70;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="p-8 rounded-[2.5rem] bg-white shadow-premium border border-slate-50 flex flex-col items-center justify-center text-center group hover:shadow-2xl transition-all duration-500 h-full">
      <div className="relative mb-6">
        <svg
          height={radius * 2}
          width={radius * 2}
          className="transform -rotate-90 group-hover:scale-105 transition-transform duration-500"
        >
          <circle
            stroke="#f1f5f9"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke="currentColor"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="text-primary transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-slate-900 tracking-tighter">{percentage}%</span>
          <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">+10%</span>
        </div>
      </div>
      <h3 className="text-xl font-black text-slate-900 tracking-tight">{label}</h3>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Daily Performance Target</p>
    </div>
  );
}

export function VolumeChart({ 
  data, 
  labels, 
  title = "Patient Volume", 
  subtitle = "Last 6 Months Overview" 
}: { 
  data: number[], 
  labels?: string[],
  title?: string,
  subtitle?: string
}) {
  const maxVal = Math.max(...data, 1);
  
  return (
    <div className="p-8 rounded-[2.5rem] bg-white shadow-premium border border-slate-50 flex flex-col group hover:shadow-2xl transition-all duration-500 col-span-1 lg:col-span-2">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{subtitle}</p>
        </div>
        <div className="p-2 rounded-xl bg-slate-50">
            <Activity className="h-4 w-4 text-slate-400" />
        </div>
      </div>

      <div className="flex-1 flex items-end justify-between gap-2 min-h-[220px] px-2">
        {data.map((val, i) => {
          const barHeight = (val / maxVal) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center group/bar max-w-[60px]">
              <div 
                className="w-full bg-slate-50 rounded-2xl relative transition-all duration-500 hover:bg-primary/5 cursor-pointer overflow-hidden" 
                style={{ height: `${barHeight}%`, minHeight: '8px' }}
              >
                <div 
                  className={cn(
                    "absolute bottom-0 left-0 right-0 rounded-2xl transition-all duration-700",
                    i === data.length - 1 ? "bg-primary" : "bg-slate-200 group-hover/bar:bg-primary/40"
                  )} 
                  style={{ height: '100%' }} 
                />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 group-hover/bar:text-slate-900 transition-colors whitespace-nowrap">
                {labels ? labels[i] : (i + 1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AppointmentOverviewChart({ data, loading }: { data: any, loading: boolean }) {
  const COLORS = {
    completed: "#10b981", // emerald-500
    upcoming: "#f59e0b", // amber-500
    cancelled: "#ef4444", // red-500
    noshow: "#94a3b8", // slate-400
  };

  const chartData = React.useMemo(() => {
    if (!data?.current) return [];
    const { completedAppointments, upcomingAppointments, cancelledAppointments, noShowAppointments } = data.current;
    return [
      { name: "Completed", value: completedAppointments, color: COLORS.completed },
      { name: "Upcoming", value: upcomingAppointments, color: COLORS.upcoming },
      { name: "Cancelled", value: cancelledAppointments, color: COLORS.cancelled },
      { name: "No-show", value: noShowAppointments, color: COLORS.noshow },
    ].filter(item => item.value > 0);
  }, [data]);

  return (
    <div className="p-8 rounded-[2.5rem] bg-white shadow-premium border border-slate-50 flex flex-col group hover:shadow-2xl transition-all duration-500 h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">Appointment Overview</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status Distribution</p>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center min-h-[250px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <RechartsTooltip 
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
              />
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-10">
            <Calendar className="h-12 w-12 text-slate-100 mx-auto mb-4" />
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No data available</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        {["Completed", "Upcoming", "Cancelled", "No-show"].map((status) => (
          <div key={status} className="flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full", 
              status === "Completed" ? "bg-emerald-500" : 
              status === "Upcoming" ? "bg-amber-500" : 
              status === "Cancelled" ? "bg-red-500" : "bg-slate-400"
            )} />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsOverviewChart({ data, loading }: { data: any, loading: boolean }) {
  const chartData = data?.timeSeries || [];

  return (
    <div className="p-8 rounded-[2.5rem] bg-white shadow-premium border border-slate-50 flex flex-col group hover:shadow-2xl transition-all duration-500 col-span-1 lg:col-span-2">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">Analytics Overview</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Patient visits and revenue trend</p>
        </div>
      </div>

      <div className="flex-1 min-h-[300px]">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#256cad" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#256cad" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
              />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#256cad" 
                strokeWidth={4} 
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
                name="Revenue (₹)"
              />
              <Area 
                type="monotone" 
                dataKey="newPatients" 
                stroke="#10b981" 
                strokeWidth={4} 
                fillOpacity={1} 
                fill="url(#colorPatients)" 
                name="New Patients"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-300">
             <Activity className="h-12 w-12 mb-4 opacity-20" />
             <p className="text-[10px] font-black uppercase tracking-[0.2em]">Insufficient data for trend analysis</p>
          </div>
        )}
      </div>
    </div>
  );
}

