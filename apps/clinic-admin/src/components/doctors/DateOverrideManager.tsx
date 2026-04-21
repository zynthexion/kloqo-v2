'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, Clock, Trash2, Edit3, PlusCircle, AlertCircle, Loader2, Users } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDateOverrides } from '@/hooks/useDateOverrides';
import { displayTime12h } from '@kloqo/shared-core';
import type { Doctor, DoctorOverride } from '@kloqo/shared';
import { useToast } from "@/hooks/use-toast";

interface DateOverrideManagerProps {
  doctor: Doctor;
  onUpdate: () => Promise<void>;
}

export function DateOverrideManager({ doctor, onUpdate }: DateOverrideManagerProps) {
  const { toast } = useToast();
  const { isPending, addOverride, removeOverride, markLeave } = useDateOverrides(doctor, onUpdate);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: new Date(), to: undefined });
  const [isOff, setIsOff] = useState(false);
  const [sessions, setSessions] = useState<{ from: string; to: string }[]>([{ from: '09:00', to: '17:00' }]);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const handleSaveSpecific = async (force: boolean = false) => {
    if (!selectedDate) return;
    setConflictError(null);
    try {
      if (isOff) {
        await markLeave(selectedDate, undefined, force);
      } else {
        const override: DoctorOverride = { isOff: false, slots: sessions };
        await addOverride(selectedDate, override, force);
      }
    } catch (err: any) {
      if (err.message?.includes('ORPHANED_TOKENS_DETECTED')) {
        setConflictError(err.message);
      }
    }
  };

  const handleSaveRange = async (force: boolean = false) => {
    if (!dateRange?.from || !dateRange?.to) return;
    setConflictError(null);
    try {
      await markLeave(dateRange.from, dateRange.to, force);
    } catch (err: any) {
      if (err.message?.includes('ORPHANED_TOKENS_DETECTED')) {
        setConflictError(err.message);
      }
    }
  };

  const handleEdit = (dateKey: string, override: DoctorOverride) => {
    try {
      let parsedDate = new Date();
      if (dateKey.includes('-')) {
        const [y, m, d] = dateKey.split('-').map(Number);
        if (y && m && d) parsedDate = new Date(y, m - 1, d);
      } else {
        parsedDate = new Date(dateKey);
      }
      setSelectedDate(parsedDate);
      
      setIsOff(override.isOff);
      if (override.slots && override.slots.length > 0) {
        setSessions(override.slots);
      } else if (!override.isOff) {
        setSessions([{ from: '09:00', to: '17:00' }]);
      }
      
      // Smooth scroll to top of the card where the form is
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      toast({
        title: "Editing Override",
        description: `Loaded settings for ${dateKey}. Adjust and click 'Apply'.`
      });
    } catch (e) {
      console.error("Failed to parse dateKey", dateKey);
    }
  };

  return (
    <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] bg-white overflow-hidden mt-6">
      <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
            <CalendarIcon className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Availability Overrides</CardTitle>
            <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Manage one-off schedule changes and vacations</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <Tabs defaultValue="day" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100/50 p-1 rounded-xl h-12 mb-8">
              <TabsTrigger value="day" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Clock className="w-3 h-3 mr-2" /> Specific Day
              </TabsTrigger>
              <TabsTrigger value="range" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Users className="w-3 h-3 mr-2" /> Vacation / Range
              </TabsTrigger>
            </TabsList>

            <TabsContent value="day" className="space-y-6 mt-0">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Target Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-black rounded-xl border-2 border-slate-100 h-12", !selectedDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-100/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-black text-slate-800">Mark as Day Off</Label>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cancels existing appts</p>
                </div>
                <Switch checked={isOff} onCheckedChange={setIsOff} />
              </div>

              {!isOff && (
                <div className="space-y-4">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Custom Hours (24H)</Label>
                  {sessions.map((session, index) => (
                    <div key={index} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-200">
                      <Input type="time" value={session.from} onChange={(e) => setSessions(prev => prev.map((s, i) => i === index ? { ...s, from: e.target.value } : s))} className="rounded-xl border-2 border-slate-100 font-black text-xs h-10 w-32 text-center" />
                      <span className="text-[10px] font-black text-slate-300 uppercase">to</span>
                      <Input type="time" value={session.to} onChange={(e) => setSessions(prev => prev.map((s, i) => i === index ? { ...s, to: e.target.value } : s))} className="rounded-xl border-2 border-slate-100 font-black text-xs h-10 w-32 text-center" />
                      {sessions.length > 1 && <Button variant="ghost" size="icon" onClick={() => setSessions(prev => prev.filter((_, i) => i !== index))} className="text-red-500 hover:bg-red-50 rounded-xl"><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setSessions([...sessions, { from: '09:00', to: '17:00' }])} className="text-[10px] font-black text-theme-blue uppercase tracking-widest hover:bg-theme-blue/5 rounded-xl">
                    <PlusCircle className="h-3 w-3 mr-2" /> Add Session
                  </Button>
                </div>
              )}

              {conflictError && (
                <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex gap-3 animate-in shake duration-300">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-black text-red-800 uppercase tracking-tight">Cancellation Action Required</p>
                    <p className="text-[10px] text-red-600 font-bold leading-relaxed">
                      {conflictError.replace('ORPHANED_TOKENS_DETECTED:', '')}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleSaveSpecific(true)}
                      disabled={isPending}
                      className="mt-2 text-[10px] font-black uppercase tracking-tight border-red-200 text-red-700 hover:bg-red-100/50 rounded-xl"
                    >
                      {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Users className="h-3 w-3 mr-2" />}
                      Cancel Affected Patients & Save
                    </Button>
                  </div>
                </div>
              )}

              <Button onClick={() => handleSaveSpecific(false)} disabled={isPending || !selectedDate || (conflictError !== null)} className="w-full h-12 rounded-xl bg-slate-800 font-black uppercase text-xs tracking-widest text-white shadow-lg shadow-black/20">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Apply Override"}
              </Button>
            </TabsContent>

            <TabsContent value="range" className="space-y-6 mt-0">
              <div className="space-y-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Vacation Period</Label>
                <div className="rounded-xl border-2 border-slate-100 p-2 bg-slate-50/30">
                  <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} disabled={(date) => date < new Date()} className="rounded-xl" />
                </div>
                {dateRange?.from && dateRange?.to && (
                  <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 p-3 rounded-xl uppercase tracking-widest text-center mt-2">
                    {format(dateRange.from, "MMM dd")} — {format(dateRange.to, "MMM dd, yyyy")}
                  </p>
                )}
              </div>
              <Button onClick={() => handleSaveRange(false)} disabled={isPending || !dateRange?.to || (conflictError !== null)} className="w-full h-12 rounded-xl bg-red-500 font-black uppercase text-xs tracking-widest text-white shadow-lg shadow-red-500/20">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Set Vacation (Mark Off)"}
              </Button>
              <p className="text-[9px] text-slate-400 font-bold uppercase text-center italic">⚠️ This will cancel all appointments in the range.</p>
              
              {conflictError && (
                <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex gap-3 animate-in shake duration-300 mt-4">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-black text-red-800 uppercase tracking-tight">Range Conflict Detected</p>
                    <p className="text-[10px] text-red-600 font-bold leading-relaxed mb-2">
                      {conflictError.replace('ORPHANED_TOKENS_DETECTED:', '')}
                    </p>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleSaveRange(true)}
                        disabled={isPending}
                        className="text-[10px] font-black uppercase tracking-tight border-red-200 text-red-700 hover:bg-red-100/50 rounded-xl"
                    >
                        {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Users className="h-3 w-3 mr-2" />}
                        Cancel All Conflicts & Save
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-4">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Active Overrides</Label>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {doctor.dateOverrides && Object.entries(doctor.dateOverrides).length > 0 ? (
                Object.entries(doctor.dateOverrides).sort().map(([dateKey, override]) => (
                  <div key={dateKey} className="p-4 rounded-2xl border-2 border-slate-50 bg-white shadow-sm flex items-center justify-between group hover:border-slate-100 transition-all">
                    <div>
                      <p className="text-sm font-black text-slate-800">{dateKey}</p>
                      <div className="flex gap-1 mt-1">
                        {override.isOff ? (
                          <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-md uppercase tracking-wider">Off</span>
                        ) : (
                          override.slots?.map((s, i) => <span key={i} className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">{displayTime12h(s.from)} - {displayTime12h(s.to)}</span>)
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(dateKey, override)} disabled={isPending} className="text-slate-300 hover:text-theme-blue hover:bg-theme-blue/5 rounded-xl">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeOverride(dateKey)} disabled={isPending} className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-widest">No active overrides</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
