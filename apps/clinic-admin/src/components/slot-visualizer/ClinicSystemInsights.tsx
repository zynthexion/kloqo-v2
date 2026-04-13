"use client";

import { Info, ShieldAlert, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Doctor } from "@kloqo/shared";

interface ClinicSystemInsightsProps {
  sessionProgress: any;
  sessionSlots: any[];
  capacityInfo: any;
  selectedDoctor: Doctor | null;
}

export function ClinicSystemInsights({
  sessionProgress,
  sessionSlots,
  capacityInfo,
  selectedDoctor,
}: ClinicSystemInsightsProps) {
  if (!sessionProgress) return null;

  return (
    <div className="mt-8 rounded-2xl border bg-gradient-to-br from-card to-muted/20 overflow-hidden shadow-lg border-primary/10">
      <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-foreground">Clinic System Insights</h3>
            <p className="text-xs text-muted-foreground font-medium">Real-time schedule health & performance metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2 py-1 px-3 rounded-full bg-background/80 ring-1 ring-inset ring-muted-foreground/10 text-xs font-bold text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Overview
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x border-b border-primary/5">
        <div className="p-6">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-wider">Completion Rate</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black">{Math.round((sessionProgress.completedCount / sessionSlots.length) * 100)}%</p>
            <p className="text-xs font-medium text-muted-foreground">{sessionProgress.completedCount} seen</p>
          </div>
          <Progress value={(sessionProgress.completedCount / sessionSlots.length) * 100} className="h-1.5 mt-3" />
        </div>
        <div className="p-6">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-wider">Wait Time Analysis</p>
          <div className="flex items-baseline gap-2">
            <p className={cn("text-3xl font-black", sessionProgress.delayMinutes > 0 ? "text-destructive" : "text-emerald-500")}>
              {sessionProgress.delayMinutes > 0 ? `+${sessionProgress.delayMinutes}` : sessionProgress.delayMinutes}m
            </p>
            <p className="text-xs font-medium text-muted-foreground">vs. expectation</p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 font-medium flex items-center gap-1">
            <Info className="h-3 w-3" />
            Based on {selectedDoctor?.averageConsultingTime || 15}m avg
          </p>
        </div>
        <div className="p-6">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-wider">Load Distribution</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-[9px] font-bold">
                <span>Advance</span>
                <span>{Math.round(capacityInfo.advancePercent)}%</span>
              </div>
              <div className="h-2 rounded-full bg-sky-100 overflow-hidden">
                <div className="h-full bg-sky-500" style={{ width: `${Math.min(capacityInfo.advancePercent, 100)}%` }} />
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-[9px] font-bold">
                <span>Walk-in</span>
                <span>{Math.round(capacityInfo.walkInPercent)}%</span>
              </div>
              <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(capacityInfo.walkInPercent, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 bg-muted/5">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-wider">Queue Health</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={sessionProgress.delayMinutes <= 15 ? "default" : "destructive"} className="px-2 py-1 font-black text-[10px]">
              {sessionProgress.delayMinutes <= 0 ? "EXCELLENT" : sessionProgress.delayMinutes <= 15 ? "GOOD" : "CONGESTED"}
            </Badge>
            <p className="text-[10px] font-medium text-muted-foreground leading-tight">
              {sessionProgress.delayMinutes <= 0 ? "Everything is running ahead or on time." : "Slight delays detected in patient movement."}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 bg-muted/10 space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-foreground/80">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Session Elapsed Time
          </span>
          <span>{sessionProgress.actualElapsed} min / {sessionProgress.totalMinutes} min total</span>
        </div>
        <div className="relative h-4 w-full rounded-full bg-background overflow-hidden ring-1 ring-inset ring-muted-foreground/10 p-[2px]">
          <div
            className="h-full rounded-full bg-primary/20 transition-all duration-1000"
            style={{ width: `${sessionProgress.progressValue}%` }}
          />
          <div
            className="absolute inset-y-0 w-1 rounded-full bg-primary shadow-[0_0_8px_rgba(255,255,255,0.5)] z-10"
            style={{ left: `${sessionProgress.actualProgressValue}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground font-black italic uppercase">
          <span>Session Start</span>
          <span>Target Finish</span>
        </div>
      </div>
    </div>
  );
}
