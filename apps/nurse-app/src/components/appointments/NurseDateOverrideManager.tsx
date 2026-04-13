'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar as CalendarIcon, 
  Trash2, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  CalendarCheck,
  Users
} from "lucide-react";
import { cn, formatTime12Hour } from "@/lib/utils";
import { format } from "date-fns";
import { apiRequest } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNurseDashboardContext } from '@/contexts/NurseDashboardContext';
import { useDateOverrides } from '@/hooks/useDateOverrides';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Doctor, DoctorOverride } from '@kloqo/shared';

interface NurseDateOverrideManagerProps {
  doctor: Doctor;
  clinicId: string;
}

export function NurseDateOverrideManager({ doctor, clinicId }: NurseDateOverrideManagerProps) {
  const { user } = useAuth();
  const { refresh } = useNurseDashboardContext();
  const { toast } = useToast();
  const { isPending: hookPending, addOverride, markLeave } = useDateOverrides(doctor, async () => {
    await refresh();
  });

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, DoctorOverride>>(doctor.dateOverrides || {});
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date } | undefined>({ from: new Date(), to: undefined });
  const [isOff, setIsOff] = useState(false);
  const [sessions, setSessions] = useState<{ from: string; to: string }[]>([{ from: '09:00', to: '17:00' }]);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Identity Gating
  const isSelf = user?.id === doctor.userId || user?.id === doctor.id;
  const isAdmin = user?.role === 'clinicAdmin' || user?.role === 'superAdmin';
  const hasAutonomy = isSelf || isAdmin;

  const fetchOverrides = useCallback(async () => {
    try {
      setLoading(true);
      const docData = await apiRequest<{ doctor: Doctor }>(`/doctors/${doctor.id}`);
      setOverrides(docData.doctor.dateOverrides || {});
    } catch (error: any) {
      console.error("[OverrideManager] Fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [doctor.id]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const handleAddOverride = async (force: boolean = false) => {
    if (!selectedDate) return;
    setConflictError(null);
    try {
      if (isOff) {
        await markLeave(selectedDate, undefined, force);
      } else {
        const override: DoctorOverride = { isOff: false, slots: sessions };
        await addOverride(selectedDate, override, force);
      }
      setIsModalOpen(false);
      fetchOverrides(); // Refresh local list
    } catch (err: any) {
      if (err.message?.includes('ORPHANED_TOKENS_DETECTED')) {
        setConflictError(err.message);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
      }
    }
  };

  const handleSaveRange = async (force: boolean = false) => {
    if (!dateRange?.from || !dateRange?.to) return;
    setConflictError(null);
    try {
      await markLeave(dateRange.from, dateRange.to, force);
      setIsModalOpen(false);
      fetchOverrides();
    } catch (err: any) {
      if (err.message?.includes('ORPHANED_TOKENS_DETECTED')) {
        setConflictError(err.message);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
      }
    }
  };

  const handleDeleteOverride = async (dateKey: string) => {
    if (!confirm('Deleting this override will restore the recurring weekly schedule for this date. Continue?')) return;
    
    setIsSubmitting(true);
    try {
      const newOverrides = { ...overrides };
      delete newOverrides[dateKey];
      
      await apiRequest(`/doctors/${doctor.id}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({
          doctorId: doctor.id,
          clinicId,
          dateOverrides: newOverrides
        })
      });

      toast({ title: 'Override Removed', description: 'Weekly schedule restored for this date.' });
      setOverrides(newOverrides);
      await refresh(); // SRE Mandate: Snap the grid back
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedDates = Object.keys(overrides).sort();

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Date Overrides</h2>
          <p className="text-sm font-bold text-slate-400">Tactical schedule modifications for specific dates.</p>
        </div>
        {!hasAutonomy ? (
          <Button 
            className="rounded-[2rem] bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest px-10 h-16 shadow-xl shadow-amber-500/20 hover:scale-[1.02] transition-transform opacity-60"
            onClick={() => toast({ title: 'Structural Restriction', description: 'Adding new complex overrides requires Admin privileges. Staff can only delete existing ones.', variant: 'default' })}
          >
            Request New Override
          </Button>
        ) : (
          <Dialog open={isModalOpen} onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) setConflictError(null);
          }}>
            <DialogTrigger asChild>
              <Button className="rounded-[2rem] bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest px-10 h-16 shadow-xl shadow-slate-900/20 hover:scale-[1.02] transition-transform">
                <Plus className="w-4 h-4 mr-2" /> Apply New Override
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
               <DialogHeader className="p-8 bg-slate-50 border-b border-slate-100">
                  <DialogTitle className="text-xl font-black uppercase tracking-tight">Schedule Override</DialogTitle>
                  <DialogDescription className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Target a specific date or mark a vacation range</DialogDescription>
               </DialogHeader>
               
               <Tabs defaultValue="day" className="w-full">
                 <div className="px-8 pt-6">
                    <TabsList className="grid w-full grid-cols-2 bg-slate-100/50 p-1 rounded-xl h-12">
                      <TabsTrigger value="day" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Clock className="w-3 h-3 mr-2" /> Specific Day
                      </TabsTrigger>
                      <TabsTrigger value="range" className="rounded-lg font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-sm">
                        <Users className="w-3 h-3 mr-2" /> Vacation / Range
                      </TabsTrigger>
                    </TabsList>
                 </div>

                 <TabsContent value="day" className="p-8 space-y-6 mt-0">
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
                        <Button variant="ghost" size="sm" onClick={() => setSessions([...sessions, { from: '09:00', to: '17:00' }])} className="text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-100 rounded-xl">
                          <Plus className="h-3 w-3 mr-2" /> Add Session
                        </Button>
                      </div>
                    )}

                    {conflictError && (
                      <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex gap-3 animate-in shake duration-300">
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-[11px] font-black text-red-800 uppercase tracking-tight">Conflict Action Required</p>
                          <p className="text-[10px] text-red-600 font-bold leading-relaxed mb-4">
                            {conflictError.replace('ORPHANED_TOKENS_DETECTED:', '')}
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleAddOverride(true)}
                            disabled={hookPending}
                            className="w-full text-[10px] font-black uppercase tracking-tight border-red-200 text-red-700 hover:bg-red-100 rounded-xl h-10"
                          >
                            {hookPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Users className="h-3 w-3 mr-2" />}
                            Cancel Conflicts & Apply
                          </Button>
                        </div>
                      </div>
                    )}

                    <Button 
                      onClick={() => handleAddOverride(false)} 
                      disabled={hookPending || !selectedDate || (conflictError !== null)}
                      className="w-full h-14 rounded-2xl bg-slate-900 font-black uppercase text-xs tracking-widest text-white shadow-xl shadow-slate-900/20"
                    >
                      {hookPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Verify & Apply Override"}
                    </Button>
                 </TabsContent>

                 <TabsContent value="range" className="p-8 space-y-6 mt-0">
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Vacation Period</Label>
                      <div className="rounded-2xl border-2 border-slate-100 p-4 bg-slate-50/30">
                        <Calendar mode="range" selected={dateRange} onSelect={setDateRange as any} numberOfMonths={1} disabled={(date) => date < new Date()} className="rounded-xl mx-auto" />
                      </div>
                      
                      {dateRange?.from && dateRange?.to && (
                        <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl text-center">
                          <p className="text-[11px] font-black text-emerald-800 uppercase tracking-[0.1em]">
                            {format(dateRange.from, "MMM dd")} — {format(dateRange.to, "MMM dd, yyyy")}
                          </p>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase mt-1">Full Leave Period</p>
                        </div>
                      )}
                    </div>

                    {conflictError && (
                      <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex gap-3 animate-in shake duration-300">
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-[11px] font-black text-red-800 uppercase tracking-tight">Range Conflict Detected</p>
                          <p className="text-[10px] text-red-600 font-bold leading-relaxed mb-4">
                            {conflictError.replace('ORPHANED_TOKENS_DETECTED:', '')}
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleSaveRange(true)}
                            disabled={hookPending}
                            className="w-full text-[10px] font-black uppercase tracking-tight border-red-200 text-red-700 hover:bg-red-100 rounded-xl h-10"
                          >
                            {hookPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Users className="h-3 w-3 mr-2" />}
                            Cancel All Range Conflicts & Save
                          </Button>
                        </div>
                      </div>
                    )}

                    <Button 
                      onClick={() => handleSaveRange(false)} 
                      disabled={hookPending || !dateRange?.to || (conflictError !== null)}
                      className="w-full h-14 rounded-2xl bg-red-500 font-black uppercase text-xs tracking-widest text-white shadow-xl shadow-red-500/20"
                    >
                      {hookPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Set Vacation (Mark Off)"}
                    </Button>
                 </TabsContent>
               </Tabs>

               <DialogFooter className="p-4 bg-slate-50/50 border-t border-slate-100">
                  <p className="text-[9px] text-slate-400 font-bold uppercase text-center w-full italic">All tactical changes trigger patient notifications if tokens are cancelled.</p>
               </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {sortedDates.length > 0 ? (
          sortedDates.map((dateKey) => {
            const override = overrides[dateKey];
            const date = new Date(dateKey);
            
            return (
              <Card key={dateKey} className="border-none shadow-2xl shadow-black/5 rounded-[3rem] bg-white overflow-hidden group hover:shadow-primary/10 transition-all duration-500 border-b-8 border-primary/5">
                <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary border border-slate-100 italic font-black text-lg">
                      {format(date, 'd')}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{format(date, 'MMMM yyyy')}</p>
                      <p className="text-sm font-black text-slate-800 uppercase tracking-tight">{format(date, 'EEEE')}</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold uppercase text-[9px] tracking-widest px-3 py-1 rounded-full">Active</Badge>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-slate-300" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configured Slots</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {override.slots?.map((slot: { from: string; to: string }, idx: number) => (
                        <div key={idx} className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl">
                          <p className="text-[11px] font-black text-slate-700 tabular-nums">
                            {formatTime12Hour(slot.from)} - {formatTime12Hour(slot.to)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tactical Active</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleDeleteOverride(dateKey)}
                      disabled={isSubmitting}
                      className="h-12 w-12 rounded-2xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300"
                    >
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full py-40 flex flex-col items-center justify-center text-slate-300 space-y-6 bg-slate-50/50 rounded-[4rem] border-2 border-dashed border-slate-100">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg">
              <CalendarCheck className="w-10 h-10 opacity-20" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Schedule Uniformity</p>
              <p className="text-sm font-bold opacity-40 max-w-xs mx-auto leading-relaxed">No date-specific overrides found. Doctor is following the standard weekly availability.</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-10 rounded-[3rem] bg-indigo-50/50 border-2 border-indigo-100/50 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group shadow-sm">
        <div className="h-20 w-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center border-2 border-indigo-500/20 shrink-0">
          <CalendarIcon className="h-10 w-10 text-indigo-600" />
        </div>
        <div className="space-y-2">
          <h4 className="text-xl font-black text-indigo-900 uppercase tracking-tight leading-none">Override Lifecycle</h4>
          <p className="text-sm font-bold text-indigo-700/70 leading-relaxed max-w-2xl">
            Date overrides take precedence over weekly availability. Deleting an override will immediately restore the default schedule. Always verify booked appointments before restoring the weekly default.
          </p>
        </div>
      </div>
    </div>
  );
}
