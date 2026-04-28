'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, parse } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Clock, 
  Calendar, 
  Edit, 
  Save, 
  Trash2, 
  AlertTriangle, 
  Loader2, 
  Copy,
  CheckCircle2,
  Plus,
  Settings2
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Doctor, DoctorAvailability } from '@kloqo/shared';
import { useForm, useFieldArray, Control } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DateOverrideManager } from './DateOverrideManager';
import { toast } from "@/hooks/use-toast";

const timeSlotSchema = z.object({
  from: z.string().min(1, "Required").regex(/^([01]\d|2[0-3]):?([0-5]\d)$/, "Format HH:mm"),
  to: z.string().min(1, "Required").regex(/^([01]\d|2[0-3]):?([0-5]\d)$/, "Format HH:mm"),
});

const availabilitySlotSchema = z.object({
  day: z.string().min(1, "Required"),
  timeSlots: z.array(timeSlotSchema).min(1, "At least one time slot is required."),
});

const weeklyAvailabilityFormSchema = z.object({
  availabilitySlots: z.array(availabilitySlotSchema),
});

type WeeklyAvailabilityFormValues = z.infer<typeof weeklyAvailabilityFormSchema>;

interface AvailabilityTabProps {
  doctor: Doctor;
  onUpdate: (updates: Partial<Doctor>) => Promise<void>;
  isPending: boolean;
  refreshData?: () => Promise<void>;
}

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function AvailabilityTab({ doctor, onUpdate, isPending, refreshData }: AvailabilityTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  
  // Local state for the "General Settings" values to avoid immediate form complexity
  const [settingsForm, setSettingsForm] = useState({
    averageConsultingTime: doctor.averageConsultingTime || 10,
    consultationFee: doctor.consultationFee || 0,
    freeFollowUpDays: doctor.freeFollowUpDays || 0,
    advanceBookingDays: doctor.advanceBookingDays || 7,
    walkInReserveRatio: doctor.walkInReserveRatio || 0.15,
    walkInTokenAllotment: doctor.walkInTokenAllotment || 5,
    tokenDistribution: doctor.tokenDistribution || 'advanced',
    gracePeriodMinutes: doctor.gracePeriodMinutes || 15
  });

  const form = useForm<WeeklyAvailabilityFormValues>({
    resolver: zodResolver(weeklyAvailabilityFormSchema),
    defaultValues: {
      availabilitySlots: doctor.availabilitySlots || []
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "availabilitySlots"
  });

  // Re-sync form when doctor data changes externally or when entering/exiting edit mode
  useEffect(() => {
    if (!isEditing) {
      form.reset({
        availabilitySlots: doctor.availabilitySlots || []
      });
    }
  }, [doctor.availabilitySlots, isEditing, form]);

  useEffect(() => {
    if (!isEditingSettings) {
      setSettingsForm({
        averageConsultingTime: doctor.averageConsultingTime || 10,
        consultationFee: doctor.consultationFee || 0,
        freeFollowUpDays: doctor.freeFollowUpDays || 0,
        advanceBookingDays: doctor.advanceBookingDays || 7,
        walkInReserveRatio: doctor.walkInReserveRatio || 0.15,
        walkInTokenAllotment: doctor.walkInTokenAllotment || 5,
        tokenDistribution: doctor.tokenDistribution || 'advanced',
        gracePeriodMinutes: doctor.gracePeriodMinutes || 15
      });
    }
  }, [doctor, isEditingSettings]);

  // --- ACTIONS ---

  const handleDayToggle = (day: string) => {
    const existingIndex = fields.findIndex(f => f.day === day);
    if (existingIndex > -1) {
      remove(existingIndex);
    } else {
      append({ 
        day, 
        timeSlots: [{ from: "09:00", to: "13:00" }, { from: "16:00", to: "20:00" }] 
      });
    }
  };

  const copyToAllWorkingDays = (index: number) => {
    const sourceSlots = fields[index].timeSlots;
    const workingDays = fields.map(f => f.day);
    
    const newAvailability = fields.map(field => ({
      ...field,
      timeSlots: [...sourceSlots]
    }));
    
    replace(newAvailability);
    toast({ title: "Schedule copied to all active days" });
  };

  const handleSave = async (values: WeeklyAvailabilityFormValues) => {
    try {
      await onUpdate({ availabilitySlots: values.availabilitySlots });
      setIsEditing(false);
      toast({ title: "Schedule Updated Successfully" });
    } catch (error) {
       toast({ variant: "destructive", title: "Update Failed", description: "Could not save availability." });
    }
  };

  const handleSettingsSave = async () => {
    try {
      await onUpdate({
        averageConsultingTime: Number(settingsForm.averageConsultingTime),
        consultationFee: Number(settingsForm.consultationFee),
        freeFollowUpDays: Number(settingsForm.freeFollowUpDays),
        advanceBookingDays: Number(settingsForm.advanceBookingDays),
        walkInReserveRatio: Number(settingsForm.walkInReserveRatio),
        walkInTokenAllotment: Number(settingsForm.walkInTokenAllotment),
        tokenDistribution: settingsForm.tokenDistribution,
        gracePeriodMinutes: Number(settingsForm.gracePeriodMinutes)
      });
      setIsEditingSettings(false);
      toast({ title: "Settings Updated" });
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to update settings" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* 🛠 CONFIGURATION BAR (Avg Time, Fee, etc.) */}
      <Card className="border-none shadow-2xl shadow-black/5 rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Clock className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Global Config</CardTitle>
              <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Session & Fee parameters</CardDescription>
            </div>
          </div>
          {!isEditingSettings ? (
            <Button onClick={() => setIsEditingSettings(true)} variant="ghost" className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-emerald-500 hover:bg-emerald-50">
              <Edit className="h-4 w-4 mr-2" /> Adjust Config
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => setIsEditingSettings(false)} variant="ghost" className="rounded-xl text-red-500 font-black uppercase text-[10px] tracking-widest">Cancel</Button>
              <Button onClick={handleSettingsSave} disabled={isPending} className="rounded-xl bg-theme-blue font-black uppercase text-[10px] tracking-widest text-white px-6 shadow-lg shadow-theme-blue/20">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Apply Changes"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-8">
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Strategy Selection */}
              <div className="md:col-span-2 xl:col-span-1 space-y-4 p-6 bg-emerald-50/30 rounded-3xl border-2 border-emerald-100/50 transition-all group">
                <Label className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] leading-none block mb-1">Queue Strategy</Label>
                {isEditingSettings ? (
                  <Select 
                    value={settingsForm.tokenDistribution} 
                    onValueChange={v => setSettingsForm({ ...settingsForm, tokenDistribution: v as 'advanced' | 'classic' })}
                  >
                    <SelectTrigger className="rounded-xl border-2 border-emerald-100 bg-white font-black text-xs text-slate-800 h-12">
                      <SelectValue placeholder="Strategy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="advanced" className="font-bold">Advanced (Buffer)</SelectItem>
                      <SelectItem value="classic" className="font-bold">Classic (Zipper)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-black text-lg text-slate-800 uppercase tracking-tight leading-none">
                      {settingsForm.tokenDistribution === 'advanced' ? "Buffer Mode" : "Zipper Mode"}
                    </p>
                    <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest bg-emerald-100 px-2 py-0.5 rounded-full">Active</span>
                  </div>
                )}
              </div>

              {/* Conditional Capacity Field */}
              <div className="md:col-span-2 xl:col-span-1 space-y-4 p-6 bg-slate-50/50 rounded-3xl border-2 border-slate-100/50 transition-all hover:border-emerald-100 group">
                 <Label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none block mb-1 group-hover:text-emerald-500 transition-colors">
                   {settingsForm.tokenDistribution === 'advanced' ? "Walk-in Buffer" : "Walk-in Frequency"}
                 </Label>
                 {isEditingSettings ? (
                    <Input 
                      type="number" 
                      step={settingsForm.tokenDistribution === 'advanced' ? "0.01" : "1"}
                      value={settingsForm.tokenDistribution === 'advanced' ? settingsForm.walkInReserveRatio : settingsForm.walkInTokenAllotment} 
                      onChange={e => setSettingsForm({ ...settingsForm, [settingsForm.tokenDistribution === 'advanced' ? 'walkInReserveRatio' : 'walkInTokenAllotment']: Number(e.target.value) })}
                      className="rounded-xl border-2 border-slate-100 bg-white font-black text-base text-slate-800 h-12 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-200" 
                    />
                 ) : (
                   <div className="flex items-baseline gap-1">
                     <p className="font-black text-2xl text-slate-800 tracking-tight leading-none">
                       {settingsForm.tokenDistribution === 'advanced' 
                         ? (settingsForm.walkInReserveRatio * 100).toFixed(0) 
                         : settingsForm.walkInTokenAllotment}
                     </p>
                     <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black ml-1">
                       {settingsForm.tokenDistribution === 'advanced' ? "%" : "patients"}
                     </span>
                   </div>
                 )}
              </div>

              {/* Other Static Fields */}
              {[
                { label: "Avg Consultation", val: settingsForm.averageConsultingTime, key: "averageConsultingTime", unit: "min" },
                { label: "Consultation Fee", val: settingsForm.consultationFee, key: "consultationFee", unit: "₹", prefix: true },
                { label: "Free Follow-up", val: settingsForm.freeFollowUpDays, key: "freeFollowUpDays", unit: "days" },
                { label: "Advance Window", val: settingsForm.advanceBookingDays, key: "advanceBookingDays", unit: "days" },
                { label: "Grace Period", val: settingsForm.gracePeriodMinutes, key: "gracePeriodMinutes", unit: "min" }
              ].map((item) => (
                <div key={item.key} className="space-y-4 p-6 bg-slate-50/50 rounded-3xl border-2 border-slate-100/50 transition-all hover:border-emerald-100 group">
                   <Label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none block mb-1 group-hover:text-emerald-500 transition-colors">{item.label}</Label>
                   {isEditingSettings ? (
                      <Input 
                        type="number" 
                        value={item.val} 
                        onChange={e => setSettingsForm({ ...settingsForm, [item.key]: Number(e.target.value) })}
                        className="rounded-xl border-2 border-slate-100 bg-white font-black text-base text-slate-800 h-12 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-200" 
                      />
                   ) : (
                     <div className="flex items-baseline gap-1">
                       {item.prefix && <span className="text-sm font-black text-slate-400">{item.unit}</span>}
                       <p className="font-black text-2xl text-slate-800 tracking-tight leading-none">{item.val}</p>
                       {!item.prefix && <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black ml-1">{item.unit}</span>}
                     </div>
                   )}
                </div>
              ))}
           </div>
        </CardContent>
      </Card>

      {/* 📅 WEEKLY SCHEDULE (THE MAIN UI) */}
      <Card className="border-none shadow-2xl shadow-black/5 rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-theme-blue/10 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-theme-blue" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Weekly Opening Hours</CardTitle>
              <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Days of the week the clinic is active</CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isEditing ? (
               <Button onClick={() => setIsEditing(true)} className="rounded-2xl bg-theme-blue font-black uppercase text-[10px] tracking-widest text-white px-8 h-12 shadow-xl shadow-theme-blue/20 hover:scale-[1.02] transition-all">
                  <Edit className="h-4 w-4 mr-2" /> Modify Schedule
                </Button>
            ) : (
               <div className="flex gap-2">
                  <Button onClick={() => { setIsEditing(false); form.reset(); }} variant="ghost" className="rounded-xl text-red-500 font-black uppercase text-[10px] tracking-widest h-12 px-6">Discard</Button>
                  <Button onClick={form.handleSubmit(handleSave)} disabled={isPending} className="rounded-2xl bg-emerald-500 font-black uppercase text-[10px] tracking-widest text-white px-8 h-12 shadow-xl shadow-emerald-200/50 hover:bg-emerald-600">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Changes
                  </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-8">
           {isEditing ? (
             <div className="space-y-10">
               {/* STEP 1: DAY SELECTOR STRIP */}
               <div className="space-y-4">
                 <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Active Days Selection</Label>
                 <div className="flex flex-wrap gap-3">
                   {ALL_DAYS.map(day => {
                     const isActive = fields.some(f => f.day === day);
                     return (
                       <button
                         key={day}
                         type="button"
                         onClick={() => handleDayToggle(day)}
                         className={cn(
                           "h-12 px-6 rounded-2xl font-black text-xs uppercase transition-all flex items-center gap-2 border-2",
                           isActive 
                             ? "bg-theme-blue border-theme-blue text-white shadow-lg shadow-theme-blue/20" 
                             : "bg-white border-slate-100 text-slate-400 hover:border-theme-blue/30 hover:text-theme-blue"
                         )}
                       >
                         {isActive && <CheckCircle2 className="h-3.5 w-3.5 fill-white/20" />}
                         {day.slice(0, 3)}
                       </button>
                     );
                   })}
                 </div>
               </div>

               {/* STEP 2: SESSION MANAGER */}
               <Form {...form}>
                 <div className="space-y-6">
                   {fields.map((field, index) => (
                     <div key={field.id} className="p-8 rounded-[2rem] bg-slate-50 border-2 border-slate-100 animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                           <div className="flex items-center gap-4">
                             <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border-2 border-slate-100 shadow-sm">
                               <Calendar className="h-5 w-5 text-theme-blue" />
                             </div>
                             <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{field.day}</h3>
                             <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full uppercase tracking-widest">Active</span>
                           </div>
                           
                           <div className="flex items-center gap-3">
                             <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={() => copyToAllWorkingDays(index)}
                                className="rounded-xl border-2 border-slate-200 font-bold text-[10px] uppercase tracking-widest h-10 hover:border-theme-blue hover:text-theme-blue transition-colors"
                             >
                               <Copy className="h-3.5 w-3.5 mr-2" /> Copy to All Days
                             </Button>
                             <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => remove(index)}
                                className="rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 h-10 w-10 transition-colors"
                             >
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           </div>
                        </div>

                        <DayTimeSlotManager 
                           control={form.control} 
                           dayIndex={index} 
                           register={form.register} 
                        />
                     </div>
                   ))}

                   {fields.length === 0 && (
                     <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center">
                        <Calendar className="h-12 w-12 text-slate-200 mb-4" />
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">No active days selected</p>
                        <p className="text-xs text-slate-300 max-w-xs mx-auto mb-8">Click on the day buttons above to start configuring the doctor's weekly schedule.</p>
                     </div>
                   )}
                 </div>
               </Form>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {doctor.availabilitySlots?.map(slot => (
                 <div key={slot.day} className="p-8 rounded-[2.5rem] bg-white border-2 border-slate-50 shadow-sm relative overflow-hidden group hover:border-theme-blue/30 transition-all hover:shadow-xl hover:shadow-theme-blue/5">
                   {/* Visual accent */}
                   <div className="absolute top-0 left-0 w-full h-1.5 bg-theme-blue/10 group-hover:bg-theme-blue/40 transition-colors" />
                   
                   <h4 className="font-black text-sm text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-theme-blue/10 transition-colors">
                        <Calendar className="h-4 w-4 text-theme-blue" />
                     </div>
                     {slot.day}
                   </h4>
                   
                   <div className="space-y-3">
                     {slot.timeSlots.map((ts, i) => (
                       <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100/50 group-hover:bg-white transition-colors">
                         <div className="flex items-center gap-3">
                            <Clock className="h-3.5 w-3.5 text-slate-400 group-hover:text-theme-blue transition-colors" />
                            <span className="text-xs font-black text-slate-600">
                               {format(parse(ts.from, 'HH:mm', new Date()), 'hh:mm a')} – {format(parse(ts.to, 'HH:mm', new Date()), 'hh:mm a')}
                            </span>
                         </div>
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50" />
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
               
               {(!doctor.availabilitySlots || doctor.availabilitySlots.length === 0) && (
                 <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-100">
                    <AlertTriangle className="h-12 w-12 mb-6 text-amber-200" />
                    <p className="text-sm font-black uppercase tracking-[0.2em] mb-2">Schedule Not Set</p>
                    <p className="text-xs font-bold text-slate-400 max-w-xs text-center leading-relaxed">The doctor currently has no recurring weekly hours. Click "Modify Schedule" above to define them.</p>
                 </div>
               )}
             </div>
           )}
        </CardContent>
      </Card>

      {/* 🗓 DATE OVERRIDES (HOLIDAYS, SPECIFIC OFF-DAYS) */}
      <DateOverrideManager doctor={doctor} onUpdate={refreshData || (async () => { await onUpdate({ updatedAt: new Date() }) })} />
    </div>
  );
}

/**
 * Redesigned Nested Time Slot Manager
 */
function DayTimeSlotManager({ control, dayIndex, register }: { control: Control<WeeklyAvailabilityFormValues>, dayIndex: number, register: any }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `availabilitySlots.${dayIndex}.timeSlots` as const,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {fields.map((field, tsIndex) => (
        <div key={field.id} className="bg-white p-5 rounded-3xl border-2 border-slate-100 flex flex-col gap-4 relative group/slot hover:border-theme-blue/20 transition-all shadow-sm">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session {tsIndex + 1}</Label>
            {fields.length > 1 && (
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-slate-200 hover:text-red-500 transition-colors"
                onClick={() => remove(tsIndex)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-2">
               <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tight ml-2">From</span>
               <div className="relative">
                 <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                 <Input 
                   type="time"
                   {...register(`availabilitySlots.${dayIndex}.timeSlots.${tsIndex}.from`)}
                   className="rounded-xl border-2 border-slate-50 font-black text-sm h-11 pl-10 bg-slate-50/50 focus-visible:bg-white focus-visible:ring-theme-blue/10 focus-visible:border-theme-blue/30" 
                   placeholder="09:00"
                 />
               </div>
            </div>
            
            <div className="mt-6">
               <div className="w-4 h-[2px] bg-slate-200 rounded-full" />
            </div>

            <div className="flex-1 space-y-2">
               <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tight ml-2">To</span>
                <div className="relative">
                 <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                 <Input 
                   type="time"
                   {...register(`availabilitySlots.${dayIndex}.timeSlots.${tsIndex}.to`)}
                   className="rounded-xl border-2 border-slate-50 font-black text-sm h-11 pl-10 bg-slate-50/50 focus-visible:bg-white focus-visible:ring-theme-blue/10 focus-visible:border-theme-blue/30" 
                   placeholder="13:00"
                 />
               </div>
            </div>
          </div>
        </div>
      ))}
      
      {/* Quick Add Session Button */}
      <button 
        type="button" 
        onClick={() => append({ from: "", to: "" })}
        className="rounded-3xl border-2 border-dashed border-slate-200 p-5 flex flex-col items-center justify-center gap-2 text-slate-300 hover:border-theme-blue hover:text-theme-blue hover:bg-theme-blue/5 transition-all group"
      >
        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-theme-blue/10 transition-colors">
          <Plus className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest">Add Session</span>
      </button>
    </div>
  );
}
