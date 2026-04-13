"use client";

import { UseFormReturn } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Edit, Save, Loader2, Trash2, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OperatingHoursSettingsProps {
  clinicDetails: any;
  isEditingHours: boolean;
  setIsEditingHours: (editing: boolean) => void;
  isPending: boolean;
  hoursForm: UseFormReturn<any>;
  fields: any[];
  update: (index: number, value: any) => void;
  onHoursSubmit: (values: any) => void;
  handleCancelHours: () => void;
}

export function OperatingHoursSettings({
  clinicDetails,
  isEditingHours,
  setIsEditingHours,
  isPending,
  hoursForm,
  fields,
  update,
  onHoursSubmit,
  handleCancelHours,
}: OperatingHoursSettingsProps) {
  if (!clinicDetails) return <Card><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>;

  const handleTimeChange = (dayIndex: number, slotIndex: number, field: 'open' | 'close', value: string) => {
    const day = fields[dayIndex];
    const newTimeSlots = [...day.timeSlots];
    newTimeSlots[slotIndex][field] = value;
    update(dayIndex, { ...day, timeSlots: newTimeSlots });
  };

  const addTimeSlot = (dayIndex: number) => {
    const day = fields[dayIndex];
    const newTimeSlots = [...day.timeSlots, { open: '14:00', close: '18:00' }];
    update(dayIndex, { ...day, timeSlots: newTimeSlots });
  };

  const removeTimeSlot = (dayIndex: number, slotIndex: number) => {
    const day = fields[dayIndex];
    const newTimeSlots = day.timeSlots.filter((_: any, index: number) => index !== slotIndex);
    update(dayIndex, { ...day, timeSlots: newTimeSlots });
  };

  const handleClosedToggle = (dayIndex: number, isClosed: boolean) => {
    const day = fields[dayIndex];
    update(dayIndex, { ...day, isClosed });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Operating Hours</CardTitle>
          {!isEditingHours && (
            <Button variant="outline" size="icon" onClick={() => setIsEditingHours(true)} disabled={isPending}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>
        <CardDescription>Manage your clinic's weekly schedule.</CardDescription>
      </CardHeader>
      <Form {...hoursForm}>
        <form onSubmit={hoursForm.handleSubmit(onHoursSubmit)}>
          <CardContent className="space-y-4">
            {fields.map((hour, dayIndex) => (
              <div key={hour.id} className={cn("p-4 border rounded-lg", hour.isClosed && isEditingHours && "bg-muted/50")}>
                <div className="flex items-center justify-between mb-4">
                  <p className={cn("w-24 font-semibold", hour.isClosed && isEditingHours && "text-muted-foreground")}>{hour.day}</p>
                  {isEditingHours && (
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`closed-switch-${dayIndex}`}>{hour.isClosed ? 'Closed' : 'Open'}</Label>
                      <Switch
                        id={`closed-switch-${dayIndex}`}
                        checked={!hour.isClosed}
                        onCheckedChange={(checked) => handleClosedToggle(dayIndex, !checked)}
                      />
                    </div>
                  )}
                </div>

                {!hour.isClosed && (
                  <div className="space-y-3">
                    {hour.timeSlots.map((slot: any, slotIndex: number) => (
                      <div key={slotIndex} className="flex items-end gap-2">
                        <div className="space-y-1 flex-grow">
                          <Label className="text-xs">Open</Label>
                          <Input
                            type="time"
                            defaultValue={slot.open}
                            onChange={e => handleTimeChange(dayIndex, slotIndex, 'open', e.target.value)}
                            disabled={!isEditingHours || isPending}
                          />
                        </div>
                        <div className="space-y-1 flex-grow">
                          <Label className="text-xs">Close</Label>
                          <Input
                            type="time"
                            defaultValue={slot.close}
                            onChange={e => handleTimeChange(dayIndex, slotIndex, 'close', e.target.value)}
                            disabled={!isEditingHours || isPending}
                          />
                        </div>
                        {isEditingHours && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTimeSlot(dayIndex, slotIndex)}
                            disabled={hour.timeSlots.length <= 1 || isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {isEditingHours && (
                      <Button type="button" variant="link" size="sm" onClick={() => addTimeSlot(dayIndex)} className="text-primary" disabled={isPending}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Slot
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
          {isEditingHours && (
            <CardFooter className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={handleCancelHours} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Hours
              </Button>
            </CardFooter>
          )}
        </form>
      </Form>
    </Card>
  );
}
