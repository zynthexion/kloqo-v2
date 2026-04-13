'use client';

import { CalendarDays, Edit, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface AvailabilityViewProps {
  doctor: any;
  onEdit: () => void;
}

export function AvailabilityView({ doctor, onEdit }: AvailabilityViewProps) {
  const slots = (doctor.availabilitySlots || []).slice().sort((a: any, b: any) => 
    daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day)
  );

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Weekly Schedule
          </CardTitle>
          <CardDescription>Configure recurring availability for Dr. {doctor.name}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" /> Edit
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {slots.length > 0 ? (
            slots.map((slot: any, index: number) => (
              <div key={slot.day} className="relative group">
                <div className="flex flex-col gap-2">
                  <span className="font-bold text-sm text-slate-700">{slot.day}</span>
                  <div className="flex flex-wrap gap-2">
                    {slot.timeSlots.map((ts: any, i: number) => (
                      <Badge key={i} variant="outline" className="bg-white border-slate-200 text-slate-600 px-3 py-1 text-xs">
                        {ts.from} - {ts.to}
                      </Badge>
                    ))}
                  </div>
                </div>
                {index < slots.length - 1 && <Separator className="mt-4" />}
              </div>
            ))
          ) : (
            <div className="py-12 text-center rounded-xl bg-slate-50 border-2 border-dashed border-slate-200">
              <CalendarDays className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">No availability slots defined</p>
              <p className="text-xs text-slate-400 mt-1">Click Edit to configure the doctor's schedule.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
