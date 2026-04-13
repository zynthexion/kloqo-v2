'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Info, AlertTriangle, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { addDays, format } from "date-fns";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { UseFormReturn } from "react-hook-form";
import type { AppointmentFormValues, useAppointmentsPage } from "@/hooks/use-appointments-page";
import { PatientDirectory } from "./PatientDirectory";

interface BookingCardProps {
  form: UseFormReturn<AppointmentFormValues>;
  state: ReturnType<typeof useAppointmentsPage>['state'];
  actions: ReturnType<typeof useAppointmentsPage>['actions'];
  patientInputRef: React.RefObject<HTMLInputElement>;
}

export function BookingCard({ form, state, actions, patientInputRef }: BookingCardProps) {
  const {
    editingAppointment,
    selectedPatient,
    hasSelectedOption,
    isPending,
    isDrawerExpanded,
    walkInEstimate,
    isCalculatingEstimate,
    walkInEstimateUnavailable,
    selectedDoctor,
    appointmentType,
    isDateDisabled,
    availableDaysOfWeek,
    leaveDates,
    isBookingButtonDisabled,
    doctors,
    sessionSlots,
    isAdvanceCapacityReached,
    isSlotsLoading,
    layoutMode
  } = state;

  const {
    setIsDrawerExpanded,
    handleForceBookEstimate,
    onSubmit,
    onDoctorChange,
  } = actions;

  const isEditing = !!editingAppointment;

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0 space-y-6">
        {/* Step 1: Doctor Selection (The Entry Point) */}
        <div className="space-y-4">
          <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Specialist Selection</Label>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {doctors.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    onDoctorChange(doc.id);
                    form.setValue('doctorId', doc.id);
                  }}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-3 p-3 rounded-2xl border-2 transition-all duration-200 text-left min-w-[180px]",
                    selectedDoctor?.id === doc.id
                      ? "border-blue-500 bg-blue-50/50 shadow-sm"
                      : "border-slate-100 bg-white hover:border-slate-200"
                  )}
                >
                  <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-black text-xs">
                      {doc.name.split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className={cn("text-xs font-black truncate leading-none mb-1", selectedDoctor?.id === doc.id ? "text-blue-700" : "text-slate-700")}>
                      {doc.name}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase truncate tracking-tight">{doc.specialty || 'General'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 2: Appointment Type Selection */}
        <div className="bg-slate-100/50 p-1 rounded-2xl flex gap-1 h-14">
          <button
            type="button"
            onClick={() => {
              form.setValue('bookedVia', 'Advanced Booking');
              form.setValue('date', addDays(new Date(), 1));
            }}
            className={cn(
              "flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
              appointmentType === 'Advanced Booking' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Advanced
          </button>
          <button
            type="button"
            onClick={() => {
              form.setValue('bookedVia', 'Walk-in');
              form.setValue('date', new Date());
            }}
            className={cn(
              "flex-1 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
              appointmentType === 'Walk-in' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Walk-in
          </button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 3: Patient Lookup */}
            <div className="bg-white p-5 rounded-[2rem] border-2 border-slate-50 shadow-sm transition-all duration-500">
              <PatientDirectory 
                form={form} 
                state={state} 
                actions={actions} 
                patientInputRef={patientInputRef} 
              />
              
              {/* New Patient Details (Visible only when 'Add as new patient' is selected or during editing) */}
              {(!selectedPatient && hasSelectedOption || isEditing) && (
                <div className="mt-6 pt-6 border-t border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <Label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-2 px-1">Patient Identity</Label>
                  <div className="grid grid-cols-12 gap-4">
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem className="col-span-12">
                        <FormLabel className="text-[10px] font-bold uppercase text-slate-400">Verified Phone Number</FormLabel>
                        <FormControl><Input {...field} readOnly className="h-11 rounded-xl bg-slate-100/50 border-transparent text-slate-500 font-mono font-bold" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="patientName" render={({ field }) => (
                      <FormItem className="col-span-8">
                        <FormLabel className="text-[10px] font-bold uppercase text-slate-400">Full Name</FormLabel>
                        <FormControl><Input {...field} placeholder="Patient's Full Name" className="h-11 rounded-xl bg-slate-50/50 border-transparent focus:bg-white focus:border-blue-200 transition-all font-bold" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="sex" render={({ field }) => (
                      <FormItem className="col-span-4">
                        <FormLabel className="text-[10px] font-bold uppercase text-slate-400">Sex</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border-transparent focus:bg-white focus:border-blue-200 font-bold">
                              <SelectValue placeholder="Sex" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="age" render={({ field }) => (
                      <FormItem className="col-span-4">
                        <FormLabel className="text-[10px] font-bold uppercase text-slate-400">Age</FormLabel>
                        <FormControl><Input type="number" {...field} placeholder="Years" className="h-11 rounded-xl bg-slate-50/50 border-transparent focus:bg-white focus:border-blue-200 font-bold" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="place" render={({ field }) => (
                      <FormItem className="col-span-8">
                        <FormLabel className="text-[10px] font-bold uppercase text-slate-400">Location / Area</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g. Bandra, Mumbai" className="h-11 rounded-xl bg-slate-50/50 border-transparent focus:bg-white focus:border-blue-200 font-bold" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Dynamic Details Layer */}
            {(selectedPatient || hasSelectedOption || isEditing) && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Advanced Booking Logic: Calendar + Slots */}
                {appointmentType === 'Advanced Booking' ? (
                  <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white p-5 rounded-[2rem] border-2 border-slate-50 shadow-sm">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Select Schedule</Label>
                      <FormField control={form.control} name="date" render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => date && field.onChange(date)}
                            disabled={isDateDisabled}
                            modifiers={{ available: { dayOfWeek: availableDaysOfWeek }, leave: leaveDates }}
                            className="p-0"
                          />
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="bg-white p-5 rounded-[2rem] border-2 border-slate-50 shadow-sm">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Available Slots</Label>
                      {isSlotsLoading ? (
                        <div className="py-8 flex flex-col items-center justify-center">
                          <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-2" />
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center px-4">Synchronizing with Doctor's Schedule...</p>
                        </div>
                      ) : sessionSlots.length > 0 ? (
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {sessionSlots.map((session, sIdx) => (
                            <div key={sIdx} className="space-y-2">
                              <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">{session.title}</p>
                              <div className={cn(
                                "grid gap-2",
                                layoutMode === 'registration' ? "grid-cols-3" : "grid-cols-2"
                              )}>
                                {session.slots.map((slot: any, tIdx: number) => {
                                  const isSelected = form.watch('time') === slot.time;
                                  return (
                                    <button
                                      key={tIdx}
                                      type="button"
                                      disabled={slot.status !== 'available'}
                                      onClick={() => {
                                        form.setValue('time', slot.time);
                                        form.setValue('slotIndex', slot.slotIndex);
                                        form.setValue('sessionIndex', slot.sessionIndex);
                                        form.clearErrors('time');
                                      }}
                                      className={cn(
                                        "h-9 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center border-2",
                                        isSelected 
                                          ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200" 
                                          : slot.status === 'available'
                                            ? "bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:text-blue-600"
                                            : "bg-slate-50 border-transparent text-slate-200 cursor-not-allowed"
                                      )}
                                    >
                                      {slot.time}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                          <Clock className="h-6 w-6 text-slate-200 mx-auto mb-2" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {isAdvanceCapacityReached ? "Capacity Reached" : "Select a valid date"}
                          </p>
                        </div>
                      )}
                      <FormField control={form.control} name="time" render={() => <FormMessage />} />
                    </div>
                  </div>
                ) : (
                  /* Walk-in Logic: Estimate Display */
                  <div className="bg-white p-5 rounded-[2rem] border-2 border-slate-50 shadow-sm overflow-hidden relative">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Walk-in Status</Label>
                    {isCalculatingEstimate ? (
                      <div className="py-8 flex flex-col items-center justify-center">
                        <Loader2 className="h-6 w-6 text-blue-500 animate-spin mb-2" />
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Calculating...</p>
                      </div>
                    ) : walkInEstimate ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100 text-center">
                          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Time</p>
                          <p className="text-lg font-black text-emerald-700 leading-none">{format(walkInEstimate.estimatedTime, 'hh:mm a')}</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-2xl border-2 border-blue-100 text-center">
                          <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Queue</p>
                          <p className="text-lg font-black text-blue-700 leading-none">{walkInEstimate.patientsAhead} ahead</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                        <AlertTriangle className="h-5 w-5 text-slate-300 mx-auto mb-2" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Walk-in unavailable</p>
                        <Button type="button" onClick={handleForceBookEstimate} variant="link" className="text-blue-500 text-[10px] font-black uppercase mt-1">Force Book</Button>
                      </div>
                    )}
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={isBookingButtonDisabled}
                  className="w-full h-16 rounded-[2rem] bg-slate-900 hover:bg-black text-white font-black uppercase tracking-[0.2em] text-xs shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-5 w-5 animate-spin mr-3" /> : (isEditing ? "Update" : "Confirm Booking")}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
