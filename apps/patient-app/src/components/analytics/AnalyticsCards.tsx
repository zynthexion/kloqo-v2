'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

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

export function VolumeChart({ data }: { data: number[] }) {
  return (
    <div className="p-8 rounded-[2.5rem] bg-white shadow-premium border border-slate-50 flex flex-col group hover:shadow-2xl transition-all duration-500 col-span-1 lg:col-span-2">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Patient Volume</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Last 6 Months Overview</p>
        </div>
        <select className="bg-slate-50 border-none rounded-xl text-xs font-bold px-4 py-2 text-slate-600 focus:ring-1 focus:ring-primary/20">
          <option>Year 2026</option>
          <option>Year 2025</option>
        </select>
      </div>

      <div className="flex-1 flex items-end justify-between gap-2 min-h-[220px] px-2">
        {data.map((val, i) => {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
          const barHeight = (val / Math.max(...data)) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center group/bar max-w-[60px]">
              <div 
                className="w-full bg-slate-50 rounded-2xl relative transition-all duration-500 hover:bg-primary/5 cursor-pointer overflow-hidden" 
                style={{ height: `${barHeight}%`, minHeight: '20px' }}
              >
                <div 
                  className={cn(
                    "absolute bottom-0 left-0 right-0 rounded-2xl transition-all duration-700",
                    i === data.length - 1 ? "bg-primary" : "bg-slate-200 group-hover/bar:bg-primary/40"
                  )} 
                  style={{ height: '100%' }} 
                />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4 group-hover/bar:text-slate-900 transition-colors">
                {months[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
