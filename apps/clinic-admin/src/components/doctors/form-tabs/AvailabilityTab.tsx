"use client";

import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash, Clock } from "lucide-react";
import { format, parse, addMinutes, isBefore } from "date-fns";
import { parseTime, cn } from "@/lib/utils";

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayAbbreviations = ["S", "M", "T", "W", "T", "F", "S"];

interface AvailabilityTabProps {
  form: UseFormReturn<any>;
  clinicDetails: any;
  selectedDays: string[];
  setSelectedDays: (days: string[]) => void;
  sharedTimeSlots: Array<{ from: string; to: string }>;
  setSharedTimeSlots: (slots: Array<{ from: string; to: string }> | ((prev: any) => any)) => void;
  applySharedSlotsToSelectedDays: () => void;
  mode?: "full" | "tactical";
}

const generateTimeOptions = (startTime: string, endTime: string, interval: number): string[] => {
  const options = [];
  let currentTime = parse(startTime, "HH:mm", new Date());
  const end = parse(endTime, "HH:mm", new Date());
  while (isBefore(currentTime, end)) {
    options.push(format(currentTime, "HH:mm"));
    currentTime = addMinutes(currentTime, interval);
  }
  options.push(format(end, "HH:mm"));
  return options;
};

export function AvailabilityTab({
  form,
  clinicDetails,
  selectedDays,
  setSelectedDays,
  sharedTimeSlots,
  setSharedTimeSlots,
  applySharedSlotsToSelectedDays,
  mode = "full",
}: AvailabilityTabProps) {
  if (mode === "tactical") {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center shadow-xl shadow-black/5">
          <Clock className="w-10 h-10 text-slate-400" />
        </div>
        <div className="space-y-3 max-w-sm">
          <h3 className="text-xl font-black uppercase tracking-tight text-slate-800">Weekly Schedule Locked</h3>
          <p className="text-sm text-slate-500 font-bold leading-relaxed">
            Recurring weekly availability is a structural configuration limited to <span className="text-theme-blue">Clinic Admins</span>.
          </p>
          <div className="pt-4 flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tactical Actions Allowed</p>
            <div className="flex gap-2 justify-center">
              <Badge variant="outline" className="rounded-lg border-slate-200 text-slate-500 font-bold">Breaks</Badge>
              <Badge variant="outline" className="rounded-lg border-slate-200 text-slate-500 font-bold">Overrides</Badge>
              <Badge variant="outline" className="rounded-lg border-slate-200 text-slate-500 font-bold">Extensions</Badge>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <FormField
        control={form.control}
        name="availabilitySlots"
        render={({ field }) => (
          <FormItem>
            <div className="mb-4">
              <FormLabel className="text-base flex items-center gap-1">
                Weekly Availability <span className="text-red-500">*</span>
              </FormLabel>
              <FormDescription>Define the doctor's recurring weekly schedule.</FormDescription>
              <FormMessage />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                  <div className="space-y-2">
                    <Label>1. Select days to apply time slots to</Label>
                    <ToggleGroup type="multiple" value={selectedDays} onValueChange={setSelectedDays} variant="outline" className="flex-wrap justify-start">
                      {daysOfWeek.map((day, index) => {
                        const clinicDay = clinicDetails?.operatingHours?.find((h: any) => h.day === day);
                        // If clinicDay is not found, assume it's closed for safety during onboarding
                        const isDisabled = !clinicDay || !!clinicDay.isClosed;
                        const isSelected = selectedDays.includes(day);
                        return (
                          <ToggleGroupItem 
                            key={day} 
                            value={day} 
                            className={cn(
                              "h-9 w-9",
                              isDisabled && "opacity-20 cursor-not-allowed bg-muted"
                            )} 
                            disabled={isDisabled}
                            title={isDisabled ? `${day} is closed for this clinic` : undefined}
                          >
                            {dayAbbreviations[index]}
                          </ToggleGroupItem>
                        );
                      })}
                    </ToggleGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>2. Define time slots</Label>
                    {sharedTimeSlots.map((ts, index) => {
                      const firstSelectedDay = selectedDays[0] || daysOfWeek.find(day => !clinicDetails?.operatingHours?.find((h: any) => h.day === day)?.isClosed);
                      const clinicDay = clinicDetails?.operatingHours?.find((h: any) => h.day === firstSelectedDay);
                      if (!clinicDay) return null;

                      const open = clinicDay.timeSlots[0]?.open || "00:00";
                      const close = clinicDay.timeSlots[clinicDay.timeSlots.length - 1]?.close || "23:45";
                      const timeOptions = generateTimeOptions(open, close, 15);

                      const fromOptions = timeOptions.filter(t => 
                        !sharedTimeSlots.filter((_, i) => i !== index).some(s => t >= s.from && t < s.to)
                      ).slice(0, -1);

                      const nextStart = [...sharedTimeSlots]
                        .filter(s => s.from > ts.from)
                        .sort((a, b) => a.from.localeCompare(b.from))[0]?.from || close;

                      const toOptions = ts.from ? timeOptions.filter(t => t > ts.from && t <= nextStart) : [];

                      return (
                        <div key={index} className="flex items-end gap-2">
                          <div className="flex-grow space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">From</Label>
                            <Select value={ts.from} onValueChange={(v) => {
                              const newSlots = [...sharedTimeSlots];
                              newSlots[index].from = v;
                              if (newSlots[index].to <= v) newSlots[index].to = '';
                              setSharedTimeSlots(newSlots);
                            }}>
                              <SelectTrigger><SelectValue placeholder="Start" /></SelectTrigger>
                              <SelectContent>
                                {fromOptions.map(t => (
                                  <SelectItem key={t} value={t}>{format(parse(t, "HH:mm", new Date()), 'hh:mm a')}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-grow space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">To</Label>
                            <Select value={ts.to} onValueChange={(v) => {
                              const newSlots = [...sharedTimeSlots];
                              newSlots[index].to = v;
                              setSharedTimeSlots(newSlots);
                            }} disabled={!ts.from}>
                              <SelectTrigger><SelectValue placeholder="End" /></SelectTrigger>
                              <SelectContent>
                                {toOptions.map(t => (
                                  <SelectItem key={t} value={t}>{format(parse(t, "HH:mm", new Date()), 'hh:mm a')}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setSharedTimeSlots(prev => (prev as any).filter((_: any, i: number) => i !== index))} disabled={sharedTimeSlots.length <= 1}>
                            <Trash className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      );
                    })}
                    <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setSharedTimeSlots(prev => [...(prev as any), { from: "", to: "" }])}>
                      Add Another Slot
                    </Button>
                  </div>

                  <Button type="button" variant="default" className="w-full" onClick={applySharedSlotsToSelectedDays}>
                    3. Apply to Selected Days
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-semibold">Review Availability</Label>
                <div className="rounded-md border p-4 min-h-[300px] bg-background">
                  {field.value && field.value.length > 0 ? (
                    [...field.value]
                      .sort((a, b) => daysOfWeek.indexOf(String(a.day)) - daysOfWeek.indexOf(String(b.day)))
                      .map((daySlot, i) => (
                        <div key={i} className="mb-4 last:mb-0 border-b last:border-0 pb-3 last:pb-0">
                          <p className="font-bold text-sm mb-2">{daySlot.day}</p>
                          <div className="flex flex-wrap gap-2">
                            {daySlot.timeSlots.map((ts: any, j: number) => (
                              <Badge key={j} variant="secondary" className="font-mono text-[10px]">
                                {format(parse(ts.from, 'HH:mm', new Date()), 'hh:mm a')} - {format(parse(ts.to, 'HH:mm', new Date()), 'hh:mm a')}
                              </Badge>
                            ))}
                            <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto" onClick={() => {
                              const newVal = field.value.filter((_: any, idx: number) => idx !== i);
                               field.onChange(newVal);
                            }}>
                              <Trash className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-40">
                      <p className="text-xs uppercase font-black tracking-widest">No availability applied</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </FormItem>
        )}
      />
    </div>
  );
}
