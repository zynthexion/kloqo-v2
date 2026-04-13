"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Doctor, Clinic } from '@kloqo/shared';
import { Loader2, Edit, Clock, X, Trash, SquarePlus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { format, parse, isBefore, addMinutes, isSameDay } from 'date-fns';
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/api-client";

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayAbbreviations = ["S", "M", "T", "W", "T", "F", "S"];

const timeSlotSchema = z.object({
  from: z.string().min(1, "Required"),
  to: z.string().min(1, "Required"),
});

const availabilitySlotSchema = z.object({
  day: z.string(),
  timeSlots: z.array(timeSlotSchema).min(1, "At least one time slot is required."),
});

const weeklyAvailabilityFormSchema = z.object({
  availabilitySlots: z.array(availabilitySlotSchema),
});

type WeeklyAvailabilityFormValues = z.infer<typeof weeklyAvailabilityFormSchema>;

const generateTimeOptions = (startTime: string, endTime: string, interval: number): string[] => {
  const options = [];
  try {
    let currentTime = parse(startTime, "HH:mm", new Date());
    const end = parse(endTime, "HH:mm", new Date());

    while (isBefore(currentTime, end)) {
      options.push(format(currentTime, "HH:mm"));
      currentTime = addMinutes(currentTime, interval);
    }
    options.push(format(end, "HH:mm"));
  } catch (e) {
    console.error("Error generating time options:", e);
  }
  return options;
};

export default function AvailabilityManager() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [clinicDetails, setClinicDetails] = useState<Clinic | null>(null);
  const { toast } = useToast();

  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [sharedTimeSlots, setSharedTimeSlots] = useState<Array<{ from: string; to: string }>>([{ from: "09:00", to: "17:00" }]);
  
  const [activeTab, setActiveTab] = useState<string>("weekly");
  const [overrideDate, setOverrideDate] = useState<Date | undefined>(new Date());
  const [isMarkingLeave, setIsMarkingLeave] = useState(false);

  const form = useForm<WeeklyAvailabilityFormValues>({
    resolver: zodResolver(weeklyAvailabilityFormSchema),
    defaultValues: {
      availabilitySlots: [],
    },
    mode: "onBlur",
  });

  useEffect(() => {
    const id = localStorage.getItem('clinicId');
    setClinicId(id);
  }, []);

  useEffect(() => {
    if (!clinicId) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch Clinic
        const clinic = await apiRequest<Clinic>(`/clinic/${clinicId}`);
        setClinicDetails(clinic);

        // 2. Fetch Doctors
        const fetchedDoctors = await apiRequest<Doctor[]>(
          `/doctors?clinicId=${clinicId}`
        );
        setDoctors(fetchedDoctors);
        if (fetchedDoctors.length > 0) {
          const storedDoctorId = localStorage.getItem('selectedDoctorId');
          const doctorToSelect = fetchedDoctors.find((d: any) => d.id === storedDoctorId) || fetchedDoctors[0];
          setSelectedDoctor(doctorToSelect);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch data.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [clinicId, toast]);

  useEffect(() => {
    if (selectedDoctor) {
      // Convert availability slots from "hh:mm a" to "HH:mm" for the form
      const availabilitySlotsForForm: WeeklyAvailabilityFormValues['availabilitySlots'] = selectedDoctor.availabilitySlots?.map(s => ({
        day: s.day,
        timeSlots: s.timeSlots.map(ts => {
          try {
            const parsedFrom = parse(ts.from, 'hh:mm a', new Date());
            const parsedTo = parse(ts.to, 'hh:mm a', new Date());
            return {
              from: !isNaN(parsedFrom.valueOf()) ? format(parsedFrom, 'HH:mm') : ts.from,
              to: !isNaN(parsedTo.valueOf()) ? format(parsedTo, 'HH:mm') : ts.to
            };
          } catch {
            return { from: ts.from, to: ts.to };
          }
        })
      })) || [];

      form.reset({
        availabilitySlots: availabilitySlotsForForm as any,
      });
      setIsEditingAvailability(false);
      setSelectedDays([]);
    }
  }, [selectedDoctor, form]);

  const handleDoctorChange = (doctorId: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    setSelectedDoctor(doctor || null);
    localStorage.setItem('selectedDoctorId', doctorId);
  };

  const handleEditAvailability = () => {
    setIsEditingAvailability(true);
  };

  const handleAvailabilitySave = (values: WeeklyAvailabilityFormValues) => {
    if (!selectedDoctor || !clinicId) return;

    // Convert back to "hh:mm a" for backend
    const apiAvailableSlots = values.availabilitySlots.map(s => ({
      ...s,
      day: String(s.day),
      timeSlots: s.timeSlots.map(ts => ({
        from: format(parse(ts.from, "HH:mm", new Date()), "hh:mm a"),
        to: format(parse(ts.to, "HH:mm", new Date()), "hh:mm a")
      }))
    })) as any;

    startTransition(async () => {
      try {
        await apiRequest('/doctors/availability', {
          method: 'POST',
          body: JSON.stringify({
            doctorId: selectedDoctor.id,
            availabilitySlots: apiAvailableSlots
          })
        });

        const updatedDoctor = { ...selectedDoctor, availabilitySlots: apiAvailableSlots };
        setSelectedDoctor(updatedDoctor);
        setDoctors(prev => prev.map(d => d.id === selectedDoctor.id ? updatedDoctor : d));
        setIsEditingAvailability(false);
        toast({ title: "Availability Updated", description: "Successfully updated weekly schedule." });
      } catch (error) {
        console.error("Error updating availability:", error);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update availability." });
      }
    });
  };

  const handleDeleteTimeSlot = async (day: number, timeSlot: { from: string, to: string }) => {
    if (!selectedDoctor) return;

    const updatedAvailabilitySlots = selectedDoctor.availabilitySlots?.map(slot => {
      if (String(slot.day) === String(day)) {
        const updatedTimeSlots = slot.timeSlots.filter(ts => ts.from !== timeSlot.from || ts.to !== timeSlot.to);
        return { ...slot, timeSlots: updatedTimeSlots };
      }
      return slot;
    }).filter(slot => slot.timeSlots.length > 0);

    startTransition(async () => {
      try {
        await apiRequest('/doctors/availability', {
          method: 'POST',
          body: JSON.stringify({
            doctorId: selectedDoctor.id,
            availabilitySlots: updatedAvailabilitySlots
          })
        });

        const updatedDoctor = { ...selectedDoctor, availabilitySlots: updatedAvailabilitySlots };
        setSelectedDoctor(updatedDoctor);
        setDoctors(prev => prev.map(d => d.id === selectedDoctor.id ? updatedDoctor : d));
        toast({ title: "Time Slot Deleted", description: `Removed slot from ${daysOfWeek[day]}.` });
      } catch (error) {
        console.error("Error deleting time slot:", error);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not delete time slot." });
      }
    });
  };

  const applySharedSlotsToSelectedDays = () => {
    if (selectedDays.length === 0) {
      toast({ variant: "destructive", title: "No days selected", description: "Please select days." });
      return;
    }

    const validSharedTimeSlots = sharedTimeSlots.filter(ts => ts.from && ts.to);
    if (validSharedTimeSlots.length === 0) {
      toast({ variant: "destructive", title: "No slots", description: "Define at least one slot." });
      return;
    }

    // Validation against clinic hours
    for (const dayIndexString of selectedDays) {
      const dayIndex = parseInt(dayIndexString);
      const dayName = daysOfWeek[dayIndex];
      const clinicDay = clinicDetails?.operatingHours?.find(h => h.day === dayName);
      if (!clinicDay || clinicDay.isClosed) {
        toast({ variant: "destructive", title: "Invalid", description: `Clinic is closed on ${dayName}.` });
        return;
      }

      const clinicOpeningTime = clinicDay.timeSlots[0]?.open || "00:00";
      const clinicClosingTime = clinicDay.timeSlots[clinicDay.timeSlots.length - 1]?.close || "23:45";

      for (const slot of validSharedTimeSlots) {
        if (slot.from < clinicOpeningTime || slot.to > clinicClosingTime) {
          toast({
            variant: "destructive",
            title: "Outside Clinic Hours",
            description: `Slots on ${dayName} must be between ${clinicOpeningTime} and ${clinicClosingTime}.`
          });
          return;
        }
      }
    }

    const currentSlots = form.getValues('availabilitySlots') || [];
    const updatedSlots = [...currentSlots];

    for (const dayIndexString of selectedDays) {
      const dayIndex = parseInt(dayIndexString);
      const existingIndex = updatedSlots.findIndex(s => String(s.day) === dayIndexString);
      if (existingIndex >= 0) {
        updatedSlots[existingIndex] = { day: dayIndexString, timeSlots: JSON.parse(JSON.stringify(validSharedTimeSlots)) };
      } else {
        updatedSlots.push({ day: dayIndexString, timeSlots: JSON.parse(JSON.stringify(validSharedTimeSlots)) });
      }
    }

    form.setValue('availabilitySlots', updatedSlots, { shouldDirty: true, shouldValidate: true });
    toast({ title: "Slots Applied", description: `Applied to ${selectedDays.length} days.` });
  };

  const handleMarkLeave = async () => {
    if (!selectedDoctor || !overrideDate) return;
    const dateStr = format(overrideDate, 'yyyy-MM-dd');
    
    setIsMarkingLeave(true);
    try {
      await apiRequest('/doctors/mark-leave', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          date: dateStr
        })
      });

      // Update local state
      const updatedDoctor = { 
        ...selectedDoctor, 
        leaves: [...(selectedDoctor.leaves || []), { date: dateStr, reason: 'Doctor on leave' }] 
      };
      setSelectedDoctor(updatedDoctor);
      setDoctors(prev => prev.map(d => d.id === selectedDoctor.id ? updatedDoctor : d));
      
      toast({ title: "Leave Marked", description: `Doctor marked as on leave for ${dateStr}. Appointments cancelled.` });
    } catch (error) {
      console.error("Error marking leave:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not mark leave." });
    } finally {
      setIsMarkingLeave(false);
    }
  };

  const handleSaveOverride = () => {
    if (!selectedDoctor || !overrideDate) return;
    const dateStr = format(overrideDate, 'yyyy-MM-dd');
    
    // Convert shared slots to API format
    const apiSlots = sharedTimeSlots.map(ts => ({
      from: format(parse(ts.from, "HH:mm", new Date()), "hh:mm a"),
      to: format(parse(ts.to, "HH:mm", new Date()), "hh:mm a")
    }));

    // Wrap in DoctorAvailability format
    const dayIndex = overrideDate.getDay().toString();
    const formattedOverride = [{ day: dayIndex, timeSlots: apiSlots }];

    startTransition(async () => {
      try {
        await apiRequest('/doctors/availability', {
          method: 'PATCH', // Use PATCH for partial update
          body: JSON.stringify({
            doctorId: selectedDoctor.id,
            dateOverrides: {
              ...selectedDoctor.dateOverrides,
              [dateStr]: formattedOverride
            }
          })
        });

        const updatedDoctor = { 
          ...selectedDoctor, 
          dateOverrides: { ...(selectedDoctor.dateOverrides || {}), [dateStr]: formattedOverride } 
        };
        setSelectedDoctor(updatedDoctor as any);
        setDoctors(prev => prev.map(d => d.id === selectedDoctor.id ? updatedDoctor : d) as any);
        toast({ title: "Override Saved", description: `Custom availability saved for ${dateStr}.` });
      } catch (error) {
        console.error("Error saving override:", error);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not save specific date override." });
      }
    });
  };

  if (isLoading) return <div className="flex h-48 items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (doctors.length === 0) return <div className="p-4 text-center text-muted-foreground">No doctors found.</div>;

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-2">
        <Label>Select Doctor</Label>
        <Select onValueChange={handleDoctorChange} value={selectedDoctor?.id}>
          <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
          <SelectContent>
            {doctors.map(doc => <SelectItem key={doc.id} value={doc.id}>Dr. {doc.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selectedDoctor && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Schedule</CardTitle>
              <CardDescription>Manage recurring weekly availability.</CardDescription>
            </div>
            {!isEditingAvailability && (
              <Button variant="outline" size="sm" onClick={handleEditAvailability}><Edit className="mr-2 h-4 w-4" /> Edit</Button>
            )}
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="weekly">Weekly Recurring</TabsTrigger>
                <TabsTrigger value="override">Specific Date Override</TabsTrigger>
              </TabsList>
              
              <TabsContent value="weekly">
                {isEditingAvailability ? (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleAvailabilitySave)} className="space-y-6">
                      <div className="space-y-2">
                        <Label>1. Select days</Label>
                        <ToggleGroup type="multiple" value={selectedDays} onValueChange={setSelectedDays} variant="outline" className="justify-start">
                          {daysOfWeek.map((day, idx) => {
                            const isClosed = clinicDetails?.operatingHours?.find(h => h.day === day)?.isClosed;
                            return (
                              <ToggleGroupItem key={day} value={idx.toString()} disabled={isClosed} className="w-10 h-10">
                                {dayAbbreviations[idx]}
                              </ToggleGroupItem>
                            );
                          })}
                        </ToggleGroup>
                      </div>

                      <div className="space-y-4">
                        <Label>2. Define slots</Label>
                        {sharedTimeSlots.map((ts, idx) => (
                          <div key={idx} className="flex gap-2 items-end">
                            <div className="grid gap-1 flex-1">
                              <Label className="text-xs">From</Label>
                              <Select value={ts.from} onValueChange={(val) => {
                                const updated = [...sharedTimeSlots];
                                updated[idx].from = val;
                                setSharedTimeSlots(updated);
                              }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {generateTimeOptions("00:00", "23:45", 15).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-1 flex-1">
                              <Label className="text-xs">To</Label>
                              <Select value={ts.to} onValueChange={(val) => {
                                const updated = [...sharedTimeSlots];
                                updated[idx].to = val;
                                setSharedTimeSlots(updated);
                              }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {generateTimeOptions("00:00", "23:45", 15).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSharedTimeSlots(s => s.filter((_, i) => i !== idx))} disabled={sharedTimeSlots.length <= 1}>
                              <Trash className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" type="button" onClick={() => setSharedTimeSlots([...sharedTimeSlots, { from: '09:00', to: '17:00' }])}>
                          <SquarePlus className="w-4 h-4 mr-2" /> Add Slot
                        </Button>
                      </div>

                      <Button type="button" className="w-full" onClick={applySharedSlotsToSelectedDays}>3. Apply to Days</Button>

                      <div className="space-y-2">
                        <Label>Review</Label>
                        <div className="p-3 border rounded-md space-y-2 max-h-40 overflow-y-auto">
                          {form.watch('availabilitySlots')?.sort((a,b) => Number(a.day) - Number(b.day)).map(slot => (
                            <div key={slot.day} className="text-sm">
                              <span className="font-medium mr-2">{daysOfWeek[Number(slot.day)]}:</span>
                              {slot.timeSlots.map((ts, i) => <Badge key={i} variant="secondary" className="mr-1">{ts.from} - {ts.to}</Badge>)}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" type="button" onClick={() => setIsEditingAvailability(false)}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save Schedule"}</Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="space-y-4">
                    {selectedDoctor.availabilitySlots?.sort((a,b) => Number(a.day) - Number(b.day)).map(slot => (
                      <div key={slot.day}>
                        <p className="text-sm font-medium">{daysOfWeek[Number(slot.day)]}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {slot.timeSlots.map((ts, i) => (
                            <Badge key={i} variant="outline" className="group pr-7 relative">
                              {ts.from} - {ts.to}
                              <button onClick={() => handleDeleteTimeSlot(Number(slot.day), ts)} className="absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="w-3 h-3 text-red-500" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <Separator className="mt-4" />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="override" className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label>1. Select Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {overrideDate ? format(overrideDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={overrideDate} onSelect={setOverrideDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                  
                  {overrideDate && (
                    <div className="mt-2 text-xs text-muted-foreground italic">
                      Current: {
                        selectedDoctor.leaves?.some(l => l.date === format(overrideDate, 'yyyy-MM-dd')) 
                        ? <span className="text-red-500 font-bold">Doctor is on Leave</span>
                        : selectedDoctor.dateOverrides?.[format(overrideDate, 'yyyy-MM-dd')]
                        ? <span className="text-blue-500 font-bold">Custom Slots applied</span>
                        : "Follows Weekly Schedule"
                      }
                    </div>
                  )}
                </div>

                <div className="space-y-4 border-t pt-4">
                  <Label>2. Actions for selected date</Label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      variant="destructive" 
                      className="w-full" 
                      onClick={handleMarkLeave}
                      disabled={isMarkingLeave || !overrideDate}
                    >
                      {isMarkingLeave ? <Loader2 className="animate-spin mr-2" /> : <Trash className="mr-2 h-4 w-4" />}
                      Mark Leave
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => {
                        const dateStr = format(overrideDate!, 'yyyy-MM-dd');
                        const existing = selectedDoctor.dateOverrides?.[dateStr] as unknown as any[];
                        if (existing?.[0]?.timeSlots) {
                          setSharedTimeSlots(existing[0].timeSlots.map((ts: any) => {
                            try {
                              const parsedFrom = parse(ts.from, 'hh:mm a', new Date());
                              const parsedTo = parse(ts.to, 'hh:mm a', new Date());
                              return {
                                from: !isNaN(parsedFrom.valueOf()) ? format(parsedFrom, 'HH:mm') : ts.from,
                                to: !isNaN(parsedTo.valueOf()) ? format(parsedTo, 'HH:mm') : ts.to
                              };
                            } catch { return { from: '09:00', to: '17:00' }; }
                          }));
                        }
                        toast({ title: "Custom Mode", description: "Use the inputs below to set custom slots for this day." });
                      }}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Set Custom Slots
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <Label className="text-xs uppercase text-muted-foreground font-bold">Custom Slots Configuration</Label>
                    {sharedTimeSlots.map((ts, idx) => (
                      <div key={idx} className="flex gap-2 items-end">
                        <div className="grid gap-1 flex-1">
                          <Label className="text-xs">From</Label>
                          <Select value={ts.from} onValueChange={(val) => {
                            const updated = [...sharedTimeSlots];
                            updated[idx].from = val;
                            setSharedTimeSlots(updated);
                          }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {generateTimeOptions("00:00", "23:45", 15).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-1 flex-1">
                          <Label className="text-xs">To</Label>
                          <Select value={ts.to} onValueChange={(val) => {
                            const updated = [...sharedTimeSlots];
                            updated[idx].to = val;
                            setSharedTimeSlots(updated);
                          }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {generateTimeOptions("00:00", "23:45", 15).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                    <Button size="sm" className="w-full" onClick={handleSaveOverride} disabled={isPending}>
                      {isPending ? "Saving..." : "Save Override for this Date"}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
