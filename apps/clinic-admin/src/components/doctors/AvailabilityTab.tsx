'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Clock, Calendar, Edit, Save, X, Trash2, PlusCircle, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doctor } from '@kloqo/shared';
import { useForm, useFieldArray } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DateOverrideManager } from './DateOverrideManager';

const timeSlotSchema = z.object({
  from: z.string().min(1, "Required"),
  to: z.string().min(1, "Required"),
});

const availabilitySlotSchema = z.object({
  day: z.union([z.string(), z.number()]),
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
}

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function AvailabilityTab({ doctor, onUpdate, isPending }: AvailabilityTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    averageConsultingTime: doctor.averageConsultingTime || 10,
    consultationFee: doctor.consultationFee || 0,
    freeFollowUpDays: doctor.freeFollowUpDays || 0,
    advanceBookingDays: doctor.advanceBookingDays || 0
  });

  useEffect(() => {
    if (!isEditingSettings) {
      setSettingsForm({
        averageConsultingTime: doctor.averageConsultingTime || 10,
        consultationFee: doctor.consultationFee || 0,
        freeFollowUpDays: doctor.freeFollowUpDays || 0,
        advanceBookingDays: doctor.advanceBookingDays || 0
      });
    }
  }, [doctor, isEditingSettings]);

  const form = useForm<WeeklyAvailabilityFormValues>({
    resolver: zodResolver(weeklyAvailabilityFormSchema),
    defaultValues: {
      availabilitySlots: doctor.availabilitySlots || []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "availabilitySlots"
  });

  const handleSave = async (values: WeeklyAvailabilityFormValues) => {
    await onUpdate({ availabilitySlots: values.availabilitySlots });
    setIsEditing(false);
  };

  const handleSettingsSave = async () => {
    await onUpdate({
      averageConsultingTime: Number(settingsForm.averageConsultingTime),
      consultationFee: Number(settingsForm.consultationFee),
      freeFollowUpDays: Number(settingsForm.freeFollowUpDays),
      advanceBookingDays: Number(settingsForm.advanceBookingDays)
    });
    setIsEditingSettings(false);
  };

  const handleSettingsCancel = () => {
    setSettingsForm({
      averageConsultingTime: doctor.averageConsultingTime || 10,
      consultationFee: doctor.consultationFee || 0,
      freeFollowUpDays: doctor.freeFollowUpDays || 0,
      advanceBookingDays: doctor.advanceBookingDays || 0
    });
    setIsEditingSettings(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Clock className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Consultation Time</CardTitle>
              <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Global session configuration </CardDescription>
            </div>
          </div>
          {!isEditingSettings ? (
            <Button onClick={() => setIsEditingSettings(true)} variant="ghost" className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-theme-blue hover:bg-theme-blue/5">
              <Edit className="h-4 w-4 mr-2" /> Adjust Settings
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleSettingsCancel} variant="ghost" className="rounded-xl text-red-500 font-black uppercase text-[10px] tracking-widest">Cancel</Button>
              <Button onClick={handleSettingsSave} disabled={isPending} className="rounded-xl bg-theme-blue font-black uppercase text-[10px] tracking-widest text-white px-6">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Apply"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-8">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100/50">
               <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Avg Patient Time</Label>
               {isEditingSettings ? (
                  <Input 
                   type="number" value={settingsForm.averageConsultingTime} 
                   onChange={e => setSettingsForm({ ...settingsForm, averageConsultingTime: Number(e.target.value) })}
                   className="rounded-xl border-2 border-slate-100 bg-white font-black text-sm text-slate-800 h-11" 
                  />
               ) : (
                 <p className="font-black text-2xl text-slate-800 tracking-tight">{doctor.averageConsultingTime || 10} <span className="text-xs text-slate-400 uppercase tracking-widest font-black">min</span></p>
               )}
            </div>

            <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100/50">
               <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Consultation Fee</Label>
               {isEditingSettings ? (
                  <Input 
                   type="number" value={settingsForm.consultationFee} 
                   onChange={e => setSettingsForm({ ...settingsForm, consultationFee: Number(e.target.value) })}
                   className="rounded-xl border-2 border-slate-100 bg-white font-black text-sm text-slate-800 h-11" 
                  />
               ) : (
                 <p className="font-black text-2xl text-slate-800 tracking-tight">₹{doctor.consultationFee || 0}</p>
               )}
            </div>

             <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100/50">
               <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Follow-up Days</Label>
               {isEditingSettings ? (
                  <Input 
                   type="number" value={settingsForm.freeFollowUpDays} 
                   onChange={e => setSettingsForm({ ...settingsForm, freeFollowUpDays: Number(e.target.value) })}
                   className="rounded-xl border-2 border-slate-100 bg-white font-black text-sm text-slate-800 h-11" 
                  />
               ) : (
                 <p className="font-black text-2xl text-slate-800 tracking-tight">{doctor.freeFollowUpDays || 0} <span className="text-xs text-slate-400 uppercase tracking-widest font-black">days</span></p>
               )}
            </div>

             <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100/50">
               <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none block mb-1">Advance Booking</Label>
               {isEditingSettings ? (
                  <Input 
                   type="number" value={settingsForm.advanceBookingDays} 
                   onChange={e => setSettingsForm({ ...settingsForm, advanceBookingDays: Number(e.target.value) })}
                   className="rounded-xl border-2 border-slate-100 bg-white font-black text-sm text-slate-800 h-11" 
                  />
               ) : (
                 <p className="font-black text-2xl text-slate-800 tracking-tight">{doctor.advanceBookingDays || 0} <span className="text-xs text-slate-400 uppercase tracking-widest font-black">days</span></p>
               )}
            </div>
           </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-2xl shadow-black/5 rounded-[2rem] bg-white overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-row items-center justify-between space-y-0 text-slate-400">
           <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Weekly Availability</CardTitle>
              <CardDescription className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Days and time-slots for walk-in/online </CardDescription>
            </div>
          </div>
          {!isEditing ? (
             <Button onClick={() => setIsEditing(true)} variant="ghost" className="rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-theme-blue hover:bg-theme-blue/5">
                <Edit className="h-4 w-4 mr-2" /> Edit Schedule
              </Button>
          ) : (
             <div className="flex gap-2">
                <Button onClick={() => setIsEditing(false)} variant="ghost" className="rounded-xl text-red-500 font-black uppercase text-[10px] tracking-widest">Cancel</Button>
                <Button onClick={form.handleSubmit(handleSave)} disabled={isPending} className="rounded-xl bg-theme-blue font-black uppercase text-[10px] tracking-widest text-white px-6 shadow-lg shadow-theme-blue/20">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Update Schedule
                </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-8">
           {isEditing ? (
             <Form {...form}>
               <div className="space-y-6">
                 {fields.map((field, index) => (
                   <div key={field.id} className="p-6 rounded-3xl bg-slate-50 border-2 border-slate-100 flex flex-col md:flex-row items-center gap-6">
                      <div className="flex-1">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{field.day}</Label>
                        <div className="space-y-3">
                          {field.timeSlots.map((ts, tsIndex) => (
                             <div key={tsIndex} className="flex items-center gap-3">
                               <Input value={ts.from} className="rounded-xl border-2 border-slate-100 font-black text-xs h-10 w-24 text-center" />
                               <span className="text-xs font-black text-slate-300">to</span>
                               <Input value={ts.to} className="rounded-xl border-2 border-slate-100 font-black text-xs h-10 w-24 text-center" />
                             </div>
                          ))}
                        </div>
                      </div>
                      <Button variant="ghost" className="rounded-xl bg-red-50 text-red-500 p-3 h-12 w-12" onClick={() => remove(index)}>
                        <Trash2 className="h-5 w-5" />
                      </Button>
                   </div>
                 ))}
                 <Button type="button" variant="outline" className="w-full h-16 rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 font-black uppercase text-xs tracking-widest hover:border-theme-blue hover:text-theme-blue transition-all" onClick={() => append({ day: "Monday", timeSlots: [{ from: "09:00", to: "17:00" }] })}>
                   <PlusCircle className="h-5 w-5 mr-3" /> Add Available Day
                 </Button>
               </div>
             </Form>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {doctor.availabilitySlots?.map(slot => (
                 <div key={slot.day} className="p-6 rounded-[2rem] bg-white border-2 border-slate-50 shadow-sm relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500/5 group-hover:bg-theme-blue/5 transition-colors" />
                   <h4 className="font-black text-sm text-slate-800 uppercase tracking-widest mb-3">{slot.day}</h4>
                   <div className="space-y-2">
                     {slot.timeSlots.map((ts, i) => (
                       <div key={i} className="flex items-center gap-2 text-xs font-black text-slate-500 bg-slate-50 py-2 px-3 rounded-xl border border-slate-100/50">
                         <Clock className="h-3 w-3 text-theme-blue" strokeWidth={3} />
                         <span>{ts.from} – {ts.to}</span>
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
               {(!doctor.availabilitySlots || doctor.availabilitySlots.length === 0) && (
                 <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
                    <AlertTriangle className="h-10 w-10 mb-4 text-amber-200" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">No weekly schedule defined</p>
                 </div>
               )}
             </div>
           )}
        </CardContent>
      </Card>

      <DateOverrideManager doctor={doctor} onUpdate={() => onUpdate({ updatedAt: new Date() })} />
    </div>
  );
}
