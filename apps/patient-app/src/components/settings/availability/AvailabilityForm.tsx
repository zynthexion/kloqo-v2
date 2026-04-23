'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Save, Trash, X, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Form } from '@/components/ui/form';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn, parseTime } from '@/lib/utils';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayAbbreviations = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const timeSlotSchema = z.object({ from: z.string().min(1), to: z.string().min(1) });
const availabilitySlotSchema = z.object({
  day: z.string(),
  timeSlots: z.array(timeSlotSchema).min(1),
});
const weeklyAvailabilityFormSchema = z.object({ availabilitySlots: z.array(availabilitySlotSchema) });

interface AvailabilityFormProps {
  doctor: any;
  clinicDetails: any;
  onSave: (values: any) => void;
  onCancel: () => void;
  isPending: boolean;
  selectedDays: string[];
  setSelectedDays: (days: string[]) => void;
  sharedTimeSlots: any[];
  setSharedTimeSlots: (slots: any[]) => void;
  toast: any;
}

export function AvailabilityForm({ 
  doctor, clinicDetails, onSave, onCancel, isPending, 
  selectedDays, setSelectedDays, sharedTimeSlots, setSharedTimeSlots, toast 
}: AvailabilityFormProps) {
  
  const form = useForm({
    resolver: zodResolver(weeklyAvailabilityFormSchema),
    defaultValues: { availabilitySlots: (doctor.availabilitySlots || []).map((s: any) => ({
      ...s,
      timeSlots: s.timeSlots.map((ts: any) => ({
        from: format(parseTime(ts.from, new Date()), 'hh:mm a'),
        to: format(parseTime(ts.to, new Date()), 'hh:mm a')
      }))
    })) }
  });

  const applySharedSlotsToSelectedDays = () => {
    if (selectedDays.length === 0) return toast({ variant: 'destructive', title: 'No days selected' });
    const valid = sharedTimeSlots.filter(ts => ts.from && ts.to);
    if (valid.length === 0) return toast({ variant: 'destructive', title: 'No time slots defined' });

    const current = form.getValues('availabilitySlots') || [];
    const updated = [...current];

    for (const day of selectedDays) {
      const idx = updated.findIndex(s => s.day === day);
      const data = { day, timeSlots: JSON.parse(JSON.stringify(valid)) };
      if (idx >= 0) updated[idx] = data; else updated.push(data);
    }
    form.setValue('availabilitySlots', updated, { shouldDirty: true });
    toast({ title: 'Slots Applied' });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-8 bg-white p-6 rounded-xl shadow-sm">
        <div className="space-y-3">
          <Label className="text-sm font-semibold">1. Select days</Label>
          <ToggleGroup type="multiple" value={selectedDays} onValueChange={setSelectedDays} variant="outline" className="justify-start gap-2">
            {daysOfWeek.map((day, index) => {
              const opHours = clinicDetails?.operatingHours?.find((h: any) => h.day === day);
              const isDisabled = !opHours || opHours.isClosed;
              return (
                <ToggleGroupItem key={day} value={day} disabled={isDisabled} className={cn('w-10 h-10 border-2', isDisabled && 'opacity-50 grayscale')}>
                  {dayAbbreviations[index]}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-semibold">2. Define session times</Label>
          <div className="space-y-3">
            {sharedTimeSlots.map((ts, index) => (
              <div key={index} className="flex items-center gap-3">
                <Input type="time" value={ts.from} onChange={e => {
                  const n = [...sharedTimeSlots]; n[index].from = e.target.value; setSharedTimeSlots(n);
                }} className="flex-1" />
                <Input type="time" value={ts.to} onChange={e => {
                  const n = [...sharedTimeSlots]; n[index].to = e.target.value; setSharedTimeSlots(n);
                }} className="flex-1" />
                <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => setSharedTimeSlots(sharedTimeSlots.filter((_, i) => i !== index))} disabled={sharedTimeSlots.length <= 1}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={() => setSharedTimeSlots([...sharedTimeSlots, { from: '', to: '' }])}>Add Session</Button>
          </div>
          <Button type="button" className="w-full mt-4" onClick={applySharedSlotsToSelectedDays}>Apply to Selected Days</Button>
        </div>

        <div className="space-y-3 border-t pt-6">
          <Label className="text-sm font-semibold">3. Review Availability</Label>
          <div className="space-y-3 rounded-xl border-2 border-slate-100 bg-slate-50/50 p-4 max-h-[300px] overflow-y-auto">
            {form.watch('availabilitySlots')?.length > 0 ? (
              ([...form.watch('availabilitySlots')] as any[]).sort((a: any, b: any) => daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day)).map((slot: any) => (
                <div key={slot.day} className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-sm block mb-1">{slot.day}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {slot.timeSlots.map((ts: any, i: number) => <Badge key={i} variant="secondary" className="text-[10px]">{ts.from} - {ts.to}</Badge>)}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => form.setValue('availabilitySlots', (form.getValues('availabilitySlots') as any[]).filter((s: any) => s.day !== slot.day))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))
            ) : <p className="text-center text-xs text-slate-400 py-4">No availability defined yet.</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-white">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={isPending || form.watch('availabilitySlots')?.length === 0}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Schedule
          </Button>
        </div>
      </form>
    </Form>
  );
}
