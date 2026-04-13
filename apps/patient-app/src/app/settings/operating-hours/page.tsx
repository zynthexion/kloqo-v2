'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Edit, Save, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import AppFrameLayout from '@/components/layout/AppFrameLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api-client';

const timeSlotSchema = z.object({
  open: z.string().min(1, 'Required'),
  close: z.string().min(1, 'Required'),
});
const daySchema = z.object({
  day: z.string(),
  timeSlots: z.array(timeSlotSchema),
  isClosed: z.boolean(),
});
const formSchema = z.object({ hours: z.array(daySchema) });
type FormValues = z.infer<typeof formSchema>;

export default function OperatingHoursPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [clinicData, setClinicData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { hours: [] },
  });
  const { fields, update } = useFieldArray({ control: form.control, name: 'hours' });

  useEffect(() => {
    if (!user?.clinicId) return;
    const fetchClinic = async () => {
      setLoading(true);
      try {
        const json = await apiRequest<any>(
          `/appointments/dashboard?clinicId=${user.clinicId}&date=${encodeURIComponent(new Date().toLocaleDateString())}`
        );
        const clinic = json.clinic;
        setClinicData(clinic);
        if (clinic?.operatingHours) {
          form.reset({ hours: clinic.operatingHours });
        }
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load clinic data.' });
      } finally {
        setLoading(false);
      }
    };
    fetchClinic();
  }, [user?.clinicId, form, toast]);

  const handleTimeChange = (dayIndex: number, slotIndex: number, field: 'open' | 'close', value: string) => {
    const day = fields[dayIndex];
    const newSlots = [...day.timeSlots];
    newSlots[slotIndex] = { ...newSlots[slotIndex], [field]: value };
    update(dayIndex, { ...day, timeSlots: newSlots });
  };

  const handleClosedToggle = (dayIndex: number, isClosed: boolean) => {
    const day = fields[dayIndex];
    update(dayIndex, { ...day, isClosed });
  };

  const onHoursSubmit = async (values: FormValues) => {
    if (!user?.clinicId) return;

    startTransition(async () => {
      try {
        await apiRequest('/clinic/settings', {
          method: 'PATCH',
          body: JSON.stringify({
            clinicId: user.clinicId,
            operatingHours: values.hours
          })
        });

        setClinicData((prev: any) => (prev ? { ...prev, operatingHours: values.hours } : null));
        toast({ title: 'Operating Hours Updated', description: 'Clinic operating hours have been saved.' });
        setIsEditing(false);
      } catch (error: any) {
        console.error('Error updating hours: ', error);
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'Could not save operating hours.' });
      }
    });
  };

  if (loading) {
    return (
      <AppFrameLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppFrameLayout>
    );
  }

  return (
    <AppFrameLayout>
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-4 p-4 border-b bg-white">
          <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
            <ArrowLeft />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Operating Hours</h1>
          </div>
        </header>

        <main className="flex-1 p-4 overflow-y-auto bg-slate-50">
          <Card>
            {!clinicData ? (
              <CardHeader><CardTitle>Clinic not found</CardTitle></CardHeader>
            ) : (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" /> Clinic Schedule
                      </CardTitle>
                      <CardDescription>View and manage your clinic's weekly schedule.</CardDescription>
                    </div>
                    {!isEditing && (
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Edit className="w-4 h-4 mr-2" /> Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onHoursSubmit)}>
                    <CardContent className="space-y-4">
                      {fields.map((hour, dayIndex) => (
                        <div key={hour.id} className={cn('p-4 border rounded-lg', hour.isClosed && isEditing && 'bg-muted/50')}>
                          <div className="flex items-center justify-between mb-3">
                            <p className={cn('w-24 font-semibold', hour.isClosed && isEditing && 'text-muted-foreground')}>{hour.day}</p>
                            {isEditing && (
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`closed-${dayIndex}`}>{hour.isClosed ? 'Closed' : 'Open'}</Label>
                                <Switch
                                  id={`closed-${dayIndex}`}
                                  checked={!hour.isClosed}
                                  onCheckedChange={checked => handleClosedToggle(dayIndex, !checked)}
                                />
                              </div>
                            )}
                          </div>
                          {!hour.isClosed && (
                            <div className="space-y-2">
                              {hour.timeSlots.map((slot, slotIndex) => (
                                <div key={slotIndex} className="flex items-end gap-2">
                                  <div className="space-y-1 flex-1">
                                    <Label className="text-xs">Open</Label>
                                    <Input
                                      type="time"
                                      defaultValue={slot.open}
                                      onChange={e => handleTimeChange(dayIndex, slotIndex, 'open', e.target.value)}
                                      disabled={!isEditing || isPending}
                                    />
                                  </div>
                                  <div className="space-y-1 flex-1">
                                    <Label className="text-xs">Close</Label>
                                    <Input
                                      type="time"
                                      defaultValue={slot.close}
                                      onChange={e => handleTimeChange(dayIndex, slotIndex, 'close', e.target.value)}
                                      disabled={!isEditing || isPending}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {hour.isClosed && !isEditing && (
                            <p className="text-sm text-muted-foreground italic">Closed</p>
                          )}
                        </div>
                      ))}
                      {isEditing && (
                        <div className="flex justify-end gap-2 pt-2 border-t sticky bottom-0 bg-white p-2 mt-2">
                          <Button type="button" variant="ghost" onClick={() => {
                            if (clinicData?.operatingHours) form.reset({ hours: clinicData.operatingHours });
                            setIsEditing(false);
                          }}>Cancel</Button>
                          <Button type="submit" disabled={isPending}>
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </form>
                </Form>
              </>
            )}
          </Card>
        </main>
      </div>
    </AppFrameLayout>
  );
}
